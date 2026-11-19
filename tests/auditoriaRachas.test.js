// Pruebas de caracterización: los casos «RIESGO» documentan fallos actuales,
// no certifican que ese comportamiento sea correcto. Ver AUDITORIA_RACHAS.md.
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { createUsuario } = require('./helpers/auth');
const Plan = require('../src/models/PlanProgreso');
const Contenido = require('../src/models/ContenidoDiario');
const { completeDay, getProfile } = require('../src/modules/plan/plan.service');
const { demoledorDeRachas, findUsuariosRezagados } = require('../src/modules/jobs/cronJobs');
const { reiniciarPlanesYNotificar, abandonarPlanesYNotificar } = require('../src/modules/jobs/job.service');
const { enviarCorreo } = require('../src/modules/email/email.service');

jest.mock('../src/modules/email/email.service', () => ({
  enviarCorreo: jest.fn().mockResolvedValue({ success: true }),
  enviarEnLote: jest.fn().mockResolvedValue({ enviados: 0, fallidos: 0 }),
  yaSeEnviaronBatch: jest.fn().mockResolvedValue(new Set())
}));

const FechaReal = Date;
const DIA = 86400000;
function reloj(iso) {
  const instante = new FechaReal(iso).getTime();
  // Solo se simula Date: los timers y el transporte de Mongo siguen siendo reales.
  const Simulada = function Date(...args) {
    return new FechaReal(...(args.length ? args : [instante]));
  };
  Simulada.prototype = FechaReal.prototype;
  Object.setPrototypeOf(Simulada, FechaReal);
  Simulada.now = () => instante;
  global.Date = Simulada;
}
beforeAll(async () => { await connect(); await Plan.init(); });
afterAll(disconnect);
beforeEach(async () => { await clearAll(); reloj('2026-11-14T03:00:00Z'); });
afterEach(() => { global.Date = FechaReal; jest.restoreAllMocks(); jest.clearAllMocks(); });

async function crear({ diasSinActividad = 2, dia = 7, racha = 6, ...extra } = {}) {
  const usuario = await createUsuario({ email: `${new mongoose.Types.ObjectId()}@example.com` });
  const ultima = new Date(Date.now() - diasSinActividad * DIA);
  const plan = await Plan.create({
    usuario_id: usuario._id, tienda_id: new mongoose.Types.ObjectId(), codigo_utilizado: 'AUDITORIA',
    fecha_inicio: new Date(Date.now() - 60 * DIA), ultima_fecha_actividad: ultima,
    dia_actual: dia, racha_dias: racha, racha_maxima: racha,
    progreso_diario: Array.from({ length: 30 }, (_, i) => ({
      dia_numero: i + 1, completado: i + 1 < dia,
      fecha_completado: i + 1 < dia ? new Date(+ultima - (dia - 2 - i) * DIA) : null,
      respuesta_usuario: i + 1 < dia ? [{ id: 'texto', valor: `Respuesta ${i + 1}`, tipo: 'texto' }] : null
    })), ...extra
  });
  return { uid: usuario._id, id: plan._id };
}
const leer = id => Plan.findById(id).select('+historial_reinicios').lean();
const respuesta = [{ id: 'texto', valor: 'Respuesta enviada', tipo: 'texto' }];

test('guardar una racha vencida produce el mismo resultado antes o después del job', async () => {
  const primero = await crear();
  const segundo = await crear();
  expect((await completeDay(primero.uid, respuesta)).racha_dias).toBe(1);
  expect((await demoledorDeRachas()).modifiedCount).toBe(1);
  expect((await completeDay(segundo.uid, respuesta)).racha_dias).toBe(1);
  // Mismo historial de actividad, resultado distinto según el orden del job.
});

test('RIESGO: respuesta de pantalla anterior al reinicio se acepta como día 1', async () => {
  const { uid, id } = await crear({ diasSinActividad: 22 });
  expect((await getProfile(uid)).dia_actual).toBe(7);
  await reiniciarPlanesYNotificar();
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(1);
  const plan = await leer(id);
  expect(plan.progreso_diario[0].respuesta_usuario).toEqual(respuesta);
  expect(plan.historial_reinicios[0].dia_actual).toBe(7);
});

test('RIESGO: repetir el mismo envío al cruzar medianoche UTC completa otro día', async () => {
  reloj('2026-11-13T23:59:59.900Z');
  const { uid, id } = await crear({ diasSinActividad: 1 });
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(7);
  reloj('2026-11-14T00:00:00.100Z');
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(8);
  const plan = await leer(id);
  expect(plan.progreso_diario[6].respuesta_usuario).toEqual(plan.progreso_diario[7].respuesta_usuario);
});

test('RIESGO: días locales consecutivos pueden quedar bloqueados por compartir fecha UTC', async () => {
  reloj('2026-11-12T22:00:00-03:00');
  const { uid } = await crear({ diasSinActividad: 1 });
  await completeDay(uid, respuesta);
  reloj('2026-11-13T20:00:00-03:00');
  await expect(completeDay(uid, respuesta)).rejects.toMatchObject({ message: 'Ya completaste la actividad de hoy' });
});

test('RIESGO: dos actividades en un día local son aceptadas a ambos lados de las 21:00', async () => {
  reloj('2026-11-13T20:59:59-03:00');
  const { uid } = await crear({ diasSinActividad: 1 });
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(7);
  reloj('2026-11-13T21:00:01-03:00');
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(8);
});

test('fallo leyendo conclusión no guarda el día y permite reintentar', async () => {
  const { uid, id } = await crear({ dia: 5, racha: 4, diasSinActividad: 1 });
  jest.spyOn(Contenido, 'findOne').mockImplementationOnce(() => {
    throw new Error('Fallo de lectura posterior al guardado');
  });
  await expect(completeDay(uid, respuesta)).rejects.toThrow('Fallo de lectura posterior');
  expect((await leer(id)).progreso_diario[4].respuesta_usuario).toBeNull();
  expect((await completeDay(uid, respuesta)).dia_completado).toBe(5);
});

test('recordatorio excluye al usuario que ya completó hoy', async () => {
  const { uid } = await crear({ diasSinActividad: 1 });
  await completeDay(uid, respuesta);
  expect((await findUsuariosRezagados(13, 0)).map(u => String(u.usuario_id))).not.toContain(String(uid));
});

test('historial inválido se reporta sin reiniciar ni interrumpir el lote', async () => {
  const { id } = await crear({ diasSinActividad: 22 });
  await Plan.collection.updateOne({ _id: id }, { $set: { historial_reinicios: 'invalido' } });
  expect((await reiniciarPlanesYNotificar()).errores).toEqual([String(id)]);
  expect((await leer(id)).dia_actual).toBe(7);
});

test('un historial inválido no impide reiniciar otro plan del mismo lote', async () => {
  const malo = await crear({ diasSinActividad: 22 });
  const sano = await crear({ diasSinActividad: 22 });
  await Plan.collection.updateOne({ _id: malo.id }, { $set: { historial_reinicios: 'invalido' } });
  const res = await reiniciarPlanesYNotificar();
  expect(res).toMatchObject({ reiniciados: 1, errores: [String(malo.id)], total_candidatos: 2 });
  expect((await leer(malo.id)).dia_actual).toBe(7);
  expect((await leer(sano.id)).historial_reinicios).toHaveLength(1);
});

test('el recordatorio se habilita al día UTC siguiente, sin perder su deduplicación', async () => {
  reloj('2026-11-13T23:59:59Z');
  const { uid } = await crear({ diasSinActividad: 1 });
  await completeDay(uid, respuesta);
  expect((await findUsuariosRezagados(13, 0)).some(u => String(u.usuario_id) === String(uid))).toBe(false);
  reloj('2026-11-14T00:00:01Z');
  expect((await findUsuariosRezagados(13, 0)).some(u => String(u.usuario_id) === String(uid))).toBe(true);
});

test('un hueco de dos días no dispara un hito aunque la racha previa era seis', async () => {
  const { uid, id } = await crear({ diasSinActividad: 2, racha: 6 });
  const res = await completeDay(uid, respuesta);
  expect(res).toMatchObject({ racha_dias: 1, hito_alcanzado: null });
  expect((await leer(id)).hitos_alcanzados).not.toContain(7);
  expect(enviarCorreo).not.toHaveBeenCalled();
});

test.each([
  ['2026-01-01T00:00:00Z', '2025-12-30T23:59:59.999Z', true],
  ['2026-01-01T00:00:00Z', '2025-12-31T00:00:00Z', false],
  ['2028-03-01T00:00:00Z', '2028-02-28T23:59:59.999Z', true],
  ['2028-03-01T00:00:00Z', '2028-02-29T00:00:00Z', false],
  ['2026-11-14T03:00:00Z', '2026-11-13T00:00:00Z', false],
  ['2026-11-14T03:00:00Z', '2026-11-12T23:59:59.999Z', true]
])('límite UTC, año y bisiesto: ahora %s última %s corte %s', async (ahora, ultima, corta) => {
  reloj(ahora);
  const { id } = await crear({ ultima_fecha_actividad: new Date(ultima) });
  const antes = await leer(id);
  expect((await demoledorDeRachas()).modifiedCount).toBe(corta ? 1 : 0);
  const despues = await leer(id);
  expect(despues.progreso_diario).toEqual(antes.progreso_diario);
  expect(despues.racha_dias).toBe(corta ? 0 : 6);
});

test('seis jobs concurrentes cortan y reportan la racha una sola vez', async () => {
  const { id } = await crear();
  const resultados = await Promise.all(Array.from({ length: 6 }, () => demoledorDeRachas()));
  expect(resultados.reduce((s, r) => s + r.modifiedCount, 0)).toBe(1);
  expect((await leer(id)).progreso_diario.filter(d => d.completado)).toHaveLength(6);
});

test('si el guardado gana, el corte seleccionado previamente no borra su racha', async () => {
  const { uid, id } = await crear();
  const original = Plan.updateOne.bind(Plan);
  jest.spyOn(Plan, 'updateOne').mockImplementationOnce(async (...args) => {
    await completeDay(uid, respuesta);
    return original(...args);
  });
  expect((await demoledorDeRachas()).modifiedCount).toBe(0);
  expect((await leer(id)).progreso_diario[6].respuesta_usuario).toEqual(respuesta);
});

test('si el corte gana, guardado en curso da conflicto y su reintento guarda una sola vez', async () => {
  const { uid, id } = await crear();
  const original = Plan.findOneAndUpdate.bind(Plan);
  jest.spyOn(Plan, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    expect((await demoledorDeRachas()).modifiedCount).toBe(1);
    return original(...args);
  });
  await expect(completeDay(uid, respuesta)).rejects.toThrow('La actividad cambió');
  expect((await completeDay(uid, respuesta)).racha_dias).toBe(1);
  expect((await leer(id)).progreso_diario[6].respuesta_usuario).toEqual(respuesta);
});

test('abandono y reactivación conservan respuestas originales una sola vez', async () => {
  const { uid, id } = await crear({ diasSinActividad: 31 });
  const antes = await leer(id);
  await abandonarPlanesYNotificar();
  expect((await leer(id)).progreso_diario).toEqual(antes.progreso_diario);
  await Promise.all(Array.from({ length: 6 }, () => getProfile(uid)));
  const despues = await leer(id);
  expect(despues.historial_reinicios).toHaveLength(1);
  expect(despues.historial_reinicios[0].progreso_diario).toEqual(antes.progreso_diario);
  expect(despues.dia_actual).toBe(1);
});

test('reintento mismo día no duplica ni cambia la respuesta ya guardada', async () => {
  const { uid, id } = await crear({ diasSinActividad: 1 });
  await completeDay(uid, respuesta);
  await expect(completeDay(uid, [{ id: 'otro', valor: 'otro' }])).rejects.toThrow('Ya completaste');
  expect((await leer(id)).progreso_diario[6].respuesta_usuario).toEqual(respuesta);
});

test('fallo de correo de hito no revierte la actividad guardada', async () => {
  const { uid, id } = await crear({ diasSinActividad: 1 });
  enviarCorreo.mockRejectedValueOnce(new Error('Proveedor no disponible'));
  expect((await completeDay(uid, respuesta)).racha_dias).toBe(7);
  // Esperar la consulta asíncrona del correo antes de limpiar la base.
  for (let i = 0; i < 100 && !enviarCorreo.mock.calls.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect(enviarCorreo).toHaveBeenCalledTimes(1);
  expect((await leer(id)).progreso_diario[6].respuesta_usuario).toEqual(respuesta);
});

test('recorrido de 30 días consecutivos, jobs repetidos y 40 días posteriores conserva todo', async () => {
  reloj('2026-12-15T12:00:00Z');
  const { uid, id } = await crear({ dia: 1, racha: 0, diasSinActividad: 0 });
  const inicio = Date.now();
  for (let dia = 1; dia <= 30; dia++) {
    reloj(inicio + (dia - 1) * DIA);
    await abandonarPlanesYNotificar();
    await reiniciarPlanesYNotificar();
    await demoledorDeRachas();
    const resultado = await completeDay(uid, [{ id: 'texto', tipo: 'texto', valor: `Día ${dia}` }]);
    expect(resultado).toMatchObject({ dia_completado: dia, racha_dias: dia });
    expect((await demoledorDeRachas()).modifiedCount).toBe(0);
  }
  const final = await leer(id);
  expect(final).toMatchObject({ dia_actual: 31, estado: 'completado', racha_dias: 30, hitos_alcanzados: [7, 14, 21, 28] });
  reloj(inicio + 70 * DIA);
  await abandonarPlanesYNotificar();
  await reiniciarPlanesYNotificar();
  await demoledorDeRachas();
  expect(await leer(id)).toEqual(final);
});

test('entrar y leer el perfil no cuenta como completar ni conserva la racha (regla actual)', async () => {
  const { uid, id } = await crear();
  const antes = await leer(id);
  await getProfile(uid);
  expect((await leer(id)).ultima_fecha_actividad).toEqual(antes.ultima_fecha_actividad);
  expect((await demoledorDeRachas()).modifiedCount).toBe(1);
  expect((await leer(id)).progreso_diario).toEqual(antes.progreso_diario);
});

test('tres ciclos completos de inactividad y vuelta preservan cada conjunto de respuestas', async () => {
  const { uid, id } = await crear({ dia: 1, racha: 0, diasSinActividad: 0 });
  for (let ciclo = 0; ciclo < 3; ciclo++) {
    await completeDay(uid, [{ id: 'texto', valor: `Ciclo ${ciclo}`, tipo: 'texto' }]);
    reloj(Date.now() + 22 * DIA);
    expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);
    expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(0);
    const plan = await leer(id);
    expect(plan.historial_reinicios).toHaveLength(ciclo + 1);
    for (let previo = 0; previo <= ciclo; previo++) {
      expect(plan.historial_reinicios[previo].progreso_diario[0].respuesta_usuario[0].valor).toBe(`Ciclo ${previo}`);
    }
  }
});
