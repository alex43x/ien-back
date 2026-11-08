const mongoose = require('mongoose');
jest.mock('../src/modules/email/email.service', () => ({ enviarCorreo: jest.fn(), enviarEnLote: jest.fn(), yaSeEnviaronBatch: jest.fn() }));
const request = require('supertest');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken } = require('./helpers/auth');
const Plan = require('../src/models/PlanProgreso');
const { decidir, evaluar, activar, asegurarSucesor, versionFiltro } = require('../src/modules/plan/intentos.service');
let app;
beforeAll(async () => { await connect(); await Plan.init(); app = require('../src/app'); });
afterAll(disconnect);
beforeEach(async () => { await clearAll(); jest.clearAllMocks(); });
const now = new Date('2026-11-07T03:00:00Z');
async function fixture(extra = {}) {
  return Plan.create({ usuario_id: new mongoose.Types.ObjectId(), tienda_id: new mongoose.Types.ObjectId(),
    codigo_utilizado: 'TEST', fecha_inicio: new Date('2026-09-01'), ultima_fecha_actividad: new Date('2026-10-29'),
    dia_actual: 2, racha_dias: 1, progreso_diario: [{ dia_numero: 1, completado: true, fecha_completado: new Date('2026-10-29'), respuesta_usuario: { texto: 'Conservar' } }], ...extra });
}
test('prioridad, corte estricto UTC y fechas anómalas', () => {
  const p = { estado: 'activo', fecha_inicio: new Date('2026-01-01'), racha_dias: 2, dia_actual: 3 };
  expect(decidir({ ...p, ultima_fecha_actividad: new Date('2026-11-06T00:00:00Z') }, now)).toBeNull();
  expect(decidir({ ...p, ultima_fecha_actividad: new Date('2026-11-05T23:59:59.999Z') }, now)).toBe('racha_rota');
  expect(decidir({ ...p, ultima_fecha_actividad: new Date('2026-10-01') }, now)).toBe('plan_abandonado');
  expect(decidir({ ...p, ultima_fecha_actividad: new Date(0) }, now)).toBeNull();
  expect(decidir({ ...p, ultima_fecha_actividad: new Date(+now - 7 * 86400000) }, now)).toBe('plan_reiniciado');
  expect(decidir({ ...p, ultima_fecha_actividad: new Date(+now - 30 * 86400000) }, now)).toBe('plan_abandonado');
  expect(decidir({ ...p, ultima_fecha_actividad: new Date(+now + 1) }, now)).toBeNull();
});
test('dos corridas preservan respuestas y crean un único sucesor pendiente', async () => {
  const p = await fixture();
  await Promise.all([evaluar({ ahora: now }), evaluar({ ahora: now })]);
  const viejo = await Plan.findById(p._id).lean();
  expect(viejo.estado).toBe('reiniciado');
  expect(viejo.progreso_diario).toEqual(p.toObject().progreso_diario);
  expect(viejo.eventos).toHaveLength(1);
  expect(await Plan.countDocuments({ intento_anterior_id: p._id })).toBe(1);
  const nuevo = await Plan.findById(viejo.sucesor_id);
  expect(nuevo.estado).toBe('pendiente');
  expect(nuevo.ultima_fecha_actividad).toBeNull();
  expect(nuevo.progreso_diario.every(d => !d.completado)).toBe(true);
});
test('reconciliación de un cierre interrumpido es idempotente', async () => {
  const p = await fixture({ estado: 'reiniciado', fecha_cierre: now, sucesor_id: new mongoose.Types.ObjectId() });
  await Promise.all([asegurarSucesor(p), asegurarSucesor(p)]);
  expect(await Plan.countDocuments({ intento_anterior_id: p._id })).toBe(1);
});
test('la versión leída no puede cerrar un plan con actividad nueva', async () => {
  const p = await fixture();
  await Plan.updateOne({ _id: p._id }, { $set: { ultima_fecha_actividad: now }, $inc: { __v: 1 } });
  const r = await Plan.updateOne(versionFiltro(p), { $set: { estado: 'abandonado' } });
  expect(r.modifiedCount).toBe(0);
});
test('activar dos veces usa el mismo intento y rechaza otro propietario', async () => {
  const data = await seed();
  const p = await fixture({ estado: 'pendiente', usuario_id: data.usuario._id, tienda_id: data.tienda1Id });
  await Promise.all([activar(p.usuario_id, p._id), activar(p.usuario_id, p._id)]);
  expect((await Plan.findById(p._id)).estado).toBe('activo');
  await expect(activar(new mongoose.Types.ObjectId(), p._id)).rejects.toThrow();
  await require('../src/models/Tienda').updateOne({ _id: data.tienda1Id }, { $set: { activo: false } });
  await expect(activar(p.usuario_id, p._id)).rejects.toThrow('La tienda');
});

test('migración dry-run no escribe y apply conserva contenido y puede repetirse', async () => {
  const p = await fixture();
  await Plan.collection.updateOne({ _id: p._id }, { $unset: { numero_intento: '' } });
  const antes = await Plan.collection.findOne({ _id: p._id });
  const { execFileSync } = require('child_process');
  const ejecutar = args => execFileSync(process.execPath, [require('path').join(__dirname, '../scripts/migrate-intentos.js'), ...args], {
    env: { ...process.env, MONGO_URI: mongoose.connection.getClient().s.url }, encoding: 'utf8', timeout: 30000, windowsHide: true
  });
  expect(ejecutar([])).toContain('sha256_contenido');
  expect(await Plan.collection.findOne({ _id: p._id })).toEqual(antes);
  ejecutar(['--apply']);
  const despues = await Plan.collection.findOne({ _id: p._id });
  expect(despues.numero_intento).toBe(1);
  expect(despues.progreso_diario).toEqual(antes.progreso_diario);
  ejecutar(['--apply']);
  expect(await Plan.collection.findOne({ _id: p._id })).toEqual(despues);
});
test('GET de plan cerrado no modifica su progreso', async () => {
  const data = await seed();
  const p = await fixture({ usuario_id: data.usuario._id, tienda_id: data.tienda1Id, estado: 'abandonado' });
  const before = await Plan.findById(p._id).lean();
  const token = generateToken(data.usuario);
  await request(app).get('/api/plan/profile').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app).get('/api/plan/today').set('Authorization', `Bearer ${token}`).expect(200);
  expect(await Plan.findById(p._id).lean()).toEqual(before);
});
test('simulación cambia solo su colección y está vedada a pacientes', async () => {
  const data = await seed();
  await request(app).get('/api/admin/simulacion').set('Authorization', `Bearer ${generateToken(data.usuario)}`).expect(403);
  const token = generateToken(data.adminGeneral);
  const count = await Plan.countDocuments();
  const r = await request(app).post('/api/admin/simulacion').set('Authorization', `Bearer ${token}`).send({ accion: 'avanzar', version: 0 }).expect(200);
  expect(r.body.dia_actual).toBe(2);
  await request(app).post('/api/admin/simulacion').set('Authorization', `Bearer ${token}`).send({ accion: 'avanzar', version: 0 }).expect(409);
  expect(await Plan.countDocuments()).toBe(count);
  await request(app).get('/api/admin/simulacion').set('Authorization', `Bearer ${generateToken(data.moderador)}`).expect(200);
});

test('outbox reintenta con la misma clave y dos workers no duplican el envío', async () => {
  const data = await seed();
  const { enviarCorreo } = require('../src/modules/email/email.service');
  const { procesarAvisos } = require('../src/modules/jobs/avisos.service');
  const p = await fixture({ usuario_id: data.usuario._id });
  await evaluar({ ahora: now });
  enviarCorreo.mockResolvedValueOnce({ success: false });
  await procesarAvisos();
  expect((await Plan.findById(p._id)).eventos[0].envio).toBe('fallido');
  enviarCorreo.mockResolvedValue({ success: true, messageId: 'test-id' });
  await Promise.all([procesarAvisos(), procesarAvisos()]);
  expect(enviarCorreo).toHaveBeenCalledTimes(2);
  expect(enviarCorreo.mock.calls[0][0].idempotencyKey).toBe(enviarCorreo.mock.calls[1][0].idempotencyKey);
  await procesarAvisos();
  expect(enviarCorreo).toHaveBeenCalledTimes(2);
  expect((await Plan.findById(p._id)).eventos[0].envio).toBe('enviado');
});

test('historial separa intentos y aplica scope y rol', async () => {
  const data = await seed();
  const p = await fixture({ usuario_id: data.usuario._id, tienda_id: data.tienda1Id });
  await evaluar({ ahora: now });
  const path = `/api/admin/pacientes/${data.usuario._id}/intentos`;
  const token = generateToken(data.adminGeneral);
  const r = await request(app).get(path).set('Authorization', `Bearer ${token}`).expect(200);
  expect(r.body.total).toBe(2);
  const detalle = await request(app).get(`${path}/${p._id}`).set('Authorization', `Bearer ${token}`).expect(200);
  expect(detalle.body.progreso_diario[0].respuesta_usuario.texto).toBe('Conservar');
  await request(app).get(path).set('Authorization', `Bearer ${generateToken(data.usuario)}`).expect(403);
  await request(app).get(path).set('Authorization', `Bearer ${generateToken(data.adminGeneral2)}`).expect(404);
});

test('completado concurrente guarda una vez, conserva texto literal y rechaza un formulario viejo', async () => {
  const data = await seed();
  const p = await fixture({ usuario_id: data.usuario._id, tienda_id: data.tienda1Id, dia_actual: 1,
    progreso_diario: [{ dia_numero: 1, completado: false }] });
  const { completeDay } = require('../src/modules/plan/plan.service');
  const contexto = { plan_id: p._id, dia_actual: 1 };
  const respuesta = { texto: '$racha_dias', nested: { ejemplo: '$$NOW' } };
  const results = await Promise.allSettled([completeDay(data.usuario._id, respuesta, contexto), completeDay(data.usuario._id, respuesta, contexto)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const guardado = await Plan.findById(p._id);
  expect(guardado.dia_actual).toBe(2);
  expect(guardado.progreso_diario[0].respuesta_usuario).toEqual(respuesta);
  await expect(completeDay(data.usuario._id, {}, contexto)).rejects.toThrow();
  await expect(completeDay(data.usuario._id, {}, { plan_id: new mongoose.Types.ObjectId(), dia_actual: 2 })).rejects.toThrow();
});
