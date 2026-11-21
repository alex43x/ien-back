const mongoose = require('mongoose');
const request = require('supertest');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { createUsuario, generateToken } = require('./helpers/auth');
const Plan = require('../src/models/PlanProgreso');
const app = require('../src/app');
const { collection, observe, waitForObservations } = require('../src/modules/auditoria/auditoria');
const { retentionMs, validator } = require('../src/modules/auditoria/schema');
const { provision } = require('../src/modules/auditoria/storage');
const { parseQuery } = require('../scripts/auditoria-consultar');
const { reiniciarPlanesYNotificar } = require('../src/modules/jobs/job.service');

jest.mock('../src/modules/email/email.service', () => ({
  enviarCorreo: jest.fn(), enviarEnLote: jest.fn().mockResolvedValue({ enviados: 1, fallidos: 0 }),
  yaSeEnviaronBatch: jest.fn().mockResolvedValue(new Set())
}));

beforeAll(async () => { await connect(); await Plan.init(); });
afterAll(disconnect);
beforeEach(clearAll);

async function fixture(diasSinActividad = 3) {
  const user = await createUsuario();
  const plan = await Plan.create({
    usuario_id: user._id, tienda_id: new mongoose.Types.ObjectId(), codigo_utilizado: 'AUDIT',
    dia_actual: 7, racha_dias: 6, racha_maxima: 6,
    fecha_inicio: new Date(Date.now() - 90 * 86400000),
    ultima_fecha_actividad: new Date(Date.now() - diasSinActividad * 86400000)
  });
  return { user, plan, bearer: 'Bearer ' + generateToken(user) };
}

function send(bearer) {
  return request(app).post('/api/plan/complete-day').set('Authorization', bearer)
    .set('X-Request-ID', 'solicitud-inventada')
    .send({ respuesta_usuario: [{ id: 'reflexion', tipo: 'texto', valor: 'RESPUESTA_PRIVADA' }] });
}

async function blockEvent(evento, run) {
  const db = mongoose.connection.db;
  await db.command({
    collMod: 'eventos_auditoria',
    validator: { $and: [validator, { evento: { $ne: evento } }] }
  });
  try {
    await run();
  } finally {
    await waitForObservations();
    await provision(db);
  }
}

test('solo confirma una actividad en paralelo y vincula estados sin copiar respuestas ni cabeceras', async () => {
  const { user, bearer } = await fixture();
  const responses = await Promise.all([send(bearer), send(bearer)]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  await waitForObservations();

  const events = await collection().find({ usuario_id: user._id }).toArray();
  expect(events).toHaveLength(4);
  const attempts = events.filter(e => e.evento === 'guardado_recibido');
  expect(attempts).toHaveLength(2);
  expect(attempts.map(e => e.solicitud_id).sort()).toEqual(events.filter(e => e.evento !== 'guardado_recibido').map(e => e.solicitud_id).sort());
  const saved = events.find(e => e.evento === 'actividad_completada');
  expect(saved).toMatchObject({
    resultado: 'confirmado', dia_programa: 7, anterior: { dia_actual: 7, racha_dias: 6, version: 0 },
    posterior: { dia_actual: 8, racha_dias: 1, version: 1 }, actor_id: user._id
  });
  expect(+saved.vence_en - +saved.fecha).toBe(retentionMs);
  expect(JSON.stringify(events)).not.toMatch(/RESPUESTA_PRIVADA|solicitud-inventada|Bearer/);
  expect(events.find(e => e.evento === 'guardado_rechazado')).toMatchObject({ resultado: 'rechazado', motivo: expect.stringMatching(/^(plan_cambio|completado_hoy)$/) });
});

test('un fallo real de validación al insertar el evento revierte el progreso', async () => {
  const { plan, bearer } = await fixture();
  await blockEvent('actividad_completada', async () => {
    expect((await send(bearer)).status).toBe(503);
    expect(await Plan.findById(plan._id).lean()).toMatchObject({ dia_actual: 7, __v: 0 });
    expect(await collection().countDocuments({ evento: 'actividad_completada' })).toBe(0);
  });
});

test('un fallo de auditoría en una lectura mantiene la API disponible', async () => {
  const { bearer } = await fixture();
  await blockEvent('perfil_programa', async () => {
    const result = await request(app).get('/api/plan/profile').set('Authorization', bearer);
    expect(result.status).toBe(200);
    await waitForObservations();
    expect(await collection().countDocuments({ evento: 'perfil_programa' })).toBe(0);
  });
});

test('el reinicio conserva la fotografía y vincula el evento y la ejecución', async () => {
  const { user, plan } = await fixture(22);
  expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);
  const updated = await Plan.findById(plan._id).select('+historial_reinicios').lean();
  const event = await collection().findOne({ evento: 'plan_reiniciado' });
  expect(event).toMatchObject({
    usuario_id: user._id, plan_id: plan._id, actor_tipo: 'job', motivo: 'inactividad',
    referencia_historial: updated.historial_reinicios[0].referencia_auditoria,
    anterior: { dia_actual: 7 }, posterior: { dia_actual: 1 }
  });
  expect(updated.historial_reinicios[0].dia_actual).toBe(7);
  expect(await collection().findOne({ evento: 'job_fin', job_id: event.job_id })).toMatchObject({
    conteo: { candidatos: 1, confirmados: 1, errores: 0 }
  });
});

test('una sesión inválida no permite atribuir un guardado a la identidad del cuerpo', async () => {
  const { user } = await fixture();
  const res = await request(app).post('/api/plan/complete-day').set('Authorization', 'Bearer privado')
    .send({ usuario_id: user._id });
  expect(res.status).toBe(401);
  await waitForObservations();
  const event = await collection().findOne({ evento: 'guardado_rechazado' });
  expect(event).toMatchObject({ actor_tipo: 'desconocido', estado_http: 401 });
  expect(event.usuario_id).toBeUndefined();
  expect(JSON.stringify(event)).not.toContain('privado');
});

test('la sesión válida se atribuye sin almacenar credenciales y distingue un 304', async () => {
  const { user, bearer } = await fixture();
  const first = await request(app).get('/api/plan/profile').set('Authorization', bearer);
  expect(first.status).toBe(200);
  const second = await request(app).get('/api/plan/profile').set('Authorization', bearer)
    .set('If-None-Match', first.headers.etag);
  expect(second.status).toBe(304);
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
  expect(login.status).toBe(200);
  const rotation = await request(app).post('/api/auth/refresh').send({ refresh_token: login.body.refresh_token });
  expect(rotation.status).toBe(200);
  const rejected = await request(app).post('/api/auth/refresh').send({ refresh_token: login.body.refresh_token });
  expect(rejected.status).toBe(401);
  const logout = await request(app).post('/api/auth/logout').send({ refresh_token: rotation.body.refresh_token });
  expect(logout.status).toBe(200);
  await waitForObservations();
  const authEvents = await collection().find({ evento: { $in: ['login', 'renovacion', 'logout'] } }).toArray();
  expect(authEvents.filter(e => e.resultado === 'confirmado').map(e => e.usuario_id)).toEqual([user._id, user._id, user._id]);
  expect(authEvents.find(e => e.resultado === 'rechazado').usuario_id).toBeUndefined();
  expect(JSON.stringify(authEvents)).not.toMatch(/password123|@example.com/);
  expect(JSON.stringify(authEvents)).not.toContain(login.body.refresh_token);
  expect(await collection().findOne({ evento: 'perfil_programa', estado_http: 304 })).toMatchObject({
    usuario_id: user._id, resultado: 'sin_cambios'
  });
});

test('reintenta un commit de resultado incierto sin duplicar la actividad ni su evento', async () => {
  const { plan, bearer } = await fixture();
  const admin = mongoose.connection.db.admin();
  await admin.command({
    configureFailPoint: 'failCommand', mode: { times: 1 },
    data: { failCommands: ['commitTransaction'], errorCode: 1, errorLabels: ['UnknownTransactionCommitResult'] }
  });
  try {
    expect((await send(bearer)).status).toBe(200);
    expect(await Plan.findById(plan._id).lean()).toMatchObject({ dia_actual: 8, __v: 1 });
    expect(await collection().countDocuments({ plan_id: plan._id, evento: 'actividad_completada' })).toBe(1);
  } finally {
    await admin.command({ configureFailPoint: 'failCommand', mode: 'off' });
  }
});

test('limita observaciones simultáneas sin dejar trabajo acumulado', async () => {
  const inserts = Array.from({ length: 250 }, () =>
    observe({ evento: 'login', resultado: 'rechazado', actor_tipo: 'desconocido' })
  );
  await Promise.all(inserts);
  const total = await collection().countDocuments({ evento: 'login' });
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(16);
  await observe({ evento: 'job_inicio', resultado: 'solicitado', actor_tipo: 'job' });
  expect(await collection().countDocuments({ evento: 'job_inicio' })).toBe(1);
});

test('la CLI valida fechas, usuario, zona y tipo antes de construir la consulta', () => {
  const args = ['--usuario', String(new mongoose.Types.ObjectId()), '--desde', '2026-11-01T00:00:00.000Z',
    '--hasta', '2026-11-18T00:00:00.000Z', '--zona', 'America/Asuncion'];
  expect(parseQuery(args).filter.fecha.$lt).toEqual(new Date('2026-11-18T00:00:00.000Z'));
  expect(() => parseQuery([...args, '--evento', '{"$ne":null}'])).toThrow();
  expect(() => parseQuery([...args, '--cursor', '2026-11-17T00:00:00.000Z/$where'])).toThrow();
  expect(() => parseQuery([...args, '--zona', 'no-valida'])).toThrow();
});

test('distingue consulta del test, envío incompleto e intento de salto', async () => {
  const { user, bearer } = await fixture();
  await request(app).get('/api/plan/test-preguntas').set('Authorization', bearer);
  await request(app).post('/api/plan/setup-test').set('Authorization', bearer).send({ dato: 'MARCA_PRIVADA' });
  await request(app).post('/api/plan/testing/advance').set('Authorization', bearer);
  await waitForObservations();
  const events = await collection().find({ usuario_id: user._id }).toArray();
  expect(events.map(e => e.evento)).toEqual(expect.arrayContaining(['preguntas_consultadas', 'envio_test_inicial', 'avance_manual_solicitado']));
  expect(events.find(e => e.evento === 'avance_manual_solicitado').resultado).toBe('rechazado');
  expect(JSON.stringify(events)).not.toContain('MARCA_PRIVADA');
});
