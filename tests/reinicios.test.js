const mongoose = require('mongoose');
const request = require('supertest');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { createAdmin, createUsuario, generateToken } = require('./helpers/auth');
const PlanProgreso = require('../src/models/PlanProgreso');
const { getInicioDeDiaDeAyer } = require('../src/utils/fechas');
const { demoledorDeRachas, findPlanesParaReiniciar, findPlanesParaAbandonar } = require('../src/modules/jobs/cronJobs');
const { abandonarPlanesYNotificar, reiniciarPlanesYNotificar } = require('../src/modules/jobs/job.service');
const { enviarEnLote } = require('../src/modules/email/email.service');

jest.mock('../src/modules/email/email.service', () => ({
  ...jest.requireActual('../src/modules/email/email.service'),
  enviarEnLote: jest.fn().mockResolvedValue({ enviados: 0, fallidos: 0 }),
  enviarCorreo: jest.fn().mockResolvedValue({})
}));

const DIA = 86400000;
const respuestaAnterior = [{ id: 'tabla', tipo: 'tabla', valor: [{ detalle: '$texto literal', seleccion: [false, 0] }] }];
let app;

beforeAll(async () => {
  await connect();
  await PlanProgreso.init();
  app = require('../src/app');
});
afterAll(disconnect);
beforeEach(async () => {
  jest.clearAllMocks();
  await clearAll();
});

async function crearPlan(cambios = {}) {
  const usuario = await createUsuario({ email: `prueba-${new mongoose.Types.ObjectId()}@example.com` });
  const plan = await PlanProgreso.create({
    usuario_id: usuario._id,
    tienda_id: new mongoose.Types.ObjectId(),
    codigo_utilizado: 'PRUEBA-REINICIO',
    fecha_inicio: new Date(Date.now() - 60 * DIA),
    ultima_fecha_actividad: new Date(Date.now() - 22 * DIA),
    dia_actual: 2,
    racha_dias: 1,
    racha_maxima: 7,
    hitos_alcanzados: [7],
    ...cambios
  });
  await PlanProgreso.updateOne({ _id: plan._id, 'progreso_diario.dia_numero': 1 }, {
    $set: {
      'progreso_diario.$.completado': true,
      'progreso_diario.$.fecha_completado': plan.ultima_fecha_actividad,
      'progreso_diario.$.respuesta_usuario': respuestaAnterior
    }
  });
  return { id: plan._id, usuarioId: usuario._id, auth: `Bearer ${generateToken(usuario)}` };
}

const leerPlan = id => PlanProgreso.findById(id).select('+historial_reinicios').lean();
const completar = (auth, respuesta) => request(app).post('/api/plan/complete-day')
  .set('Authorization', auth).send({ respuesta_usuario: respuesta });

test.each([
  [7 * DIA, false, false],
  [21 * DIA - 1, false, false],
  [21 * DIA, true, false],
  [30 * DIA - 1, true, false],
  [30 * DIA, false, true],
  [30 * DIA + 1, false, true]
])('clasifica inactividad de %i ms en el límite de reinicio o abandono', async (inactividad, reinicia, abandona) => {
  const ahora = new Date();
  const { id } = await crearPlan({ ultima_fecha_actividad: new Date(+ahora - inactividad) });
  const reloj = jest.spyOn(Date, 'now').mockReturnValue(+ahora);
  try {
    const [reinicios, abandonos] = await Promise.all([findPlanesParaReiniciar(ahora), findPlanesParaAbandonar()]);
    expect(reinicios.some(p => p.plan_id.equals(id))).toBe(reinicia);
    expect(abandonos.some(p => p.plan_id.equals(id))).toBe(abandona);
  } finally {
    reloj.mockRestore();
  }
});

test('corta la racha antes del límite UTC de ayer y conserva el avance en ambos lados del límite', async () => {
  const limite = getInicioDeDiaDeAyer();
  const anterior = await crearPlan({ ultima_fecha_actividad: new Date(+limite - 1) });
  const dentro = await crearPlan({ ultima_fecha_actividad: limite });
  const resultado = await demoledorDeRachas();
  expect(resultado.modifiedCount).toBe(1);
  for (const [id, racha] of [[anterior.id, 0], [dentro.id, 1]]) {
    const plan = await leerPlan(id);
    expect(plan).toMatchObject({ dia_actual: 2, racha_dias: racha, racha_maxima: 7, hitos_alcanzados: [7] });
    expect(plan.progreso_diario[0].respuesta_usuario).toEqual(respuestaAnterior);
    expect(plan.historial_reinicios).toBeUndefined();
  }
});

test.each(['activo', 'abandonado'])('si MongoDB rechaza el archivo, el plan %s conserva cada campo', async estado => {
  const { id, auth } = await crearPlan({ estado });
  // Un historial legado con el tipo incorrecto provoca un error real de $concatArrays.
  await PlanProgreso.collection.updateOne({ _id: id }, { $set: { historial_reinicios: 'registro inválido' } });
  const antes = await PlanProgreso.collection.findOne({ _id: id });
  if (estado === 'activo') {
    expect((await reiniciarPlanesYNotificar()).errores).toEqual([String(id)]);
  } else {
    const res = await request(app).get('/api/plan/profile').set('Authorization', auth);
    expect(res.status).toBe(503);
  }
  expect(await PlanProgreso.collection.findOne({ _id: id })).toEqual(antes);
  expect(enviarEnLote).not.toHaveBeenCalled();
});

test('dos reinicios sucesivos conservan las respuestas de ambos recorridos, incluso sin versión previa', async () => {
  const { id, auth } = await crearPlan();
  await PlanProgreso.collection.updateOne({ _id: id }, { $unset: { __v: '' } });
  const primerPlan = await leerPlan(id);
  expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);

  const segundaRespuesta = [{ id: 'reflexion', tipo: 'texto', valor: 'Segundo recorrido' }];
  expect((await completar(auth, segundaRespuesta)).status).toBe(200);
  // Simula 22 días de inactividad después de completar el nuevo día 1.
  await PlanProgreso.updateOne({ _id: id }, { $set: { ultima_fecha_actividad: new Date(Date.now() - 22 * DIA) } });
  expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);

  const final = await leerPlan(id);
  expect(final.dia_actual).toBe(1);
  expect(final.historial_reinicios).toHaveLength(2);
  expect(final.historial_reinicios[0].progreso_diario).toEqual(primerPlan.progreso_diario);
  expect(final.historial_reinicios[1].progreso_diario[0].respuesta_usuario).toEqual(segundaRespuesta);
});

test('cuatro envíos concurrentes del frontend en el día 30 guardan una respuesta y cierran el plan', async () => {
  const { id, auth } = await crearPlan({ dia_actual: 30, racha_dias: 6, hitos_alcanzados: [] });
  const respuestas = Array.from({ length: 4 }, (_, i) => [{ id: 'reflexion', tipo: 'texto', valor: `Envío ${i}` }]);
  const resultados = await Promise.all(respuestas.map(respuesta => completar(auth, respuesta)));
  const ganador = resultados.findIndex(res => res.status === 200);
  expect(resultados.filter(res => res.status === 200)).toHaveLength(1);
  expect(resultados.every(res => [200, 404, 409].includes(res.status))).toBe(true);
  expect(resultados[ganador].body).toMatchObject({ dia_completado: 30, estado: 'completado', hito_alcanzado: null });
  const plan = await leerPlan(id);
  expect(plan).toMatchObject({ dia_actual: 31, estado: 'completado', hitos_alcanzados: [] });
  expect(plan.progreso_diario[29].respuesta_usuario).toEqual(respuestas[ganador]);
  expect(plan.progreso_diario[0].respuesta_usuario).toEqual(respuestaAnterior);
  expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(0);
});

test('un guardado posterior a la selección impide abandonar el plan y enviar su aviso', async () => {
  const { id, auth } = await crearPlan({ ultima_fecha_actividad: new Date(Date.now() - 31 * DIA) });
  const actualizar = PlanProgreso.updateOne.bind(PlanProgreso);
  const respuesta = [{ id: 'reflexion', tipo: 'texto', valor: 'Volvió justo antes del abandono' }];
  const spy = jest.spyOn(PlanProgreso, 'updateOne').mockImplementationOnce(async (...args) => {
    expect((await completar(auth, respuesta)).status).toBe(200);
    return actualizar(...args);
  });
  try {
    expect(await abandonarPlanesYNotificar()).toMatchObject({ total_candidatos: 1, abandonados: 0, notificados: 0 });
    const plan = await leerPlan(id);
    expect(plan).toMatchObject({ estado: 'activo', dia_actual: 3 });
    expect(plan.progreso_diario[1].respuesta_usuario).toEqual(respuesta);
    expect(enviarEnLote).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

test('el historial permanece interno y el frontend puede completar un día sin respuestas', async () => {
  const { id, usuarioId, auth } = await crearPlan();
  expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);
  const res = await completar(auth, undefined);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ dia_completado: 1, dia_actual: 2 });

  const adminAuth = `Bearer ${generateToken(await createAdmin())}`;
  const [dias, progreso] = await Promise.all([
    request(app).get('/api/plan/days?completados=true').set('Authorization', auth),
    request(app).get(`/api/admin/pacientes/${usuarioId}/progreso`).set('Authorization', adminAuth)
  ]);
  for (const respuesta of [dias, progreso]) {
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).not.toHaveProperty('historial_reinicios');
    expect(respuesta.text).not.toContain('$texto literal');
  }
  expect(dias.body.dias).toEqual([expect.objectContaining({ dia_numero: 1, respuesta_usuario: null })]);
  const plan = await leerPlan(id);
  expect(plan.historial_reinicios[0].progreso_diario[0].respuesta_usuario).toEqual(respuestaAnterior);
});
