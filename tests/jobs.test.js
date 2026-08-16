const request = require('supertest');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const PlanProgreso = require('../src/models/PlanProgreso');
const Usuario = require('../src/models/Usuario');
const HistorialCorreo = require('../src/models/HistorialCorreo');
const { demoledorDeRachas, findUsuariosRezagados } = require('../src/modules/jobs/cronJobs');
let app;

beforeAll(async () => {
  await connect();
  app = require('../src/app');
});

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await clearAll();
});

describe('Jobs - API key auth', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('POST /api/jobs/reset-streaks - with valid API key', async () => {
    const res = await request(app)
      .post('/api/jobs/reset-streaks')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  test('POST /api/jobs/send-reminders - with valid API key', async () => {
    const res = await request(app)
      .post('/api/jobs/send-reminders')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
    expect(res.status).toBe(200);
  });

  test('POST /api/jobs/send-activation-nudge - with valid API key', async () => {
    const res = await request(app)
      .post('/api/jobs/send-activation-nudge')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
    expect(res.status).toBe(200);
  });

  test('POST /api/jobs/send-recovery - with valid API key', async () => {
    const res = await request(app)
      .post('/api/jobs/send-recovery')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
    expect(res.status).toBe(200);
  });

  test('POST /api/jobs/reset-streaks - without API key', async () => {
    const res = await request(app).post('/api/jobs/reset-streaks');
    expect(res.status).toBe(401);
  });

  test('POST /api/jobs/send-reminders - wrong API key', async () => {
    const res = await request(app)
      .post('/api/jobs/send-reminders')
      .set('X-Api-Key', 'wrong-key');
    expect(res.status).toBe(401);
  });
});

describe('demoledorDeRachas - racha_rota_en', () => {
  beforeEach(async () => { await seed(); });

  test('setea racha_rota_en cuando racha_dias > 0', async () => {
    const ahora = new Date();
    const hace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const uid = new mongoose.Types.ObjectId();
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-001',
      estado: 'activo',
      racha_dias: 5,
      ultima_fecha_actividad: hace3Dias
    });

    const res = await demoledorDeRachas();
    expect(res.modifiedCount).toBe(1);

    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.racha_dias).toBe(0);
    expect(plan.racha_rota_en).toBeInstanceOf(Date);
  });

  test('no toca racha_rota_en si racha_dias ya es 0', async () => {
    const ahora = new Date();
    const uid = new mongoose.Types.ObjectId();
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-002',
      estado: 'activo',
      racha_dias: 0,
      ultima_fecha_actividad: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      racha_rota_en: null
    });

    await demoledorDeRachas();
    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.racha_dias).toBe(0);
    expect(plan.racha_rota_en).toBeNull();
  });
});

describe('findUsuariosRezagados - filtro por horario', () => {
  let usuarioHora10;
  let usuarioHora15;
  let usuarioSinCampo;

  beforeEach(async () => {
    const tiendaId = new mongoose.Types.ObjectId();

    usuarioHora10 = await Usuario.create({
      nombre: 'Usuario Hora 10',
      email: 'hora10@test.com',
      password_hash: 'hash',
      tienda_id: tiendaId,
      hora_recordatorio_utc: 10
    });
    usuarioHora15 = await Usuario.create({
      nombre: 'Usuario Hora 15',
      email: 'hora15@test.com',
      password_hash: 'hash',
      tienda_id: tiendaId,
      hora_recordatorio_utc: 15
    });
    usuarioSinCampo = await Usuario.create({
      nombre: 'Usuario Sin Campo',
      email: 'sincampo@test.com',
      password_hash: 'hash',
      tienda_id: tiendaId
    });

    const planBase = { tienda_id: tiendaId, codigo_utilizado: 'TEST', estado: 'activo', dia_actual: 1 };
    await PlanProgreso.create({ ...planBase, usuario_id: usuarioHora10._id });
    await PlanProgreso.create({ ...planBase, usuario_id: usuarioHora15._id });
    await PlanProgreso.create({ ...planBase, usuario_id: usuarioSinCampo._id });
  });

  test('devuelve solo el usuario con la hora exacta matcheada', async () => {
    const res = await findUsuariosRezagados(10, 0);
    const ids = res.map(u => u.usuario_id.toString());
    expect(ids).toContain(usuarioHora10._id.toString());
    expect(ids).not.toContain(usuarioHora15._id.toString());
    expect(ids).not.toContain(usuarioSinCampo._id.toString());
  });

  test('el usuario sin campo matchea con el default 13:00', async () => {
    const res = await findUsuariosRezagados(13, 0);
    const ids = res.map(u => u.usuario_id.toString());
    expect(ids).toContain(usuarioSinCampo._id.toString());
    expect(ids).not.toContain(usuarioHora10._id.toString());
    expect(ids).not.toContain(usuarioHora15._id.toString());
  });

  test('devuelve vacío si ninguna hora coincide', async () => {
    const res = await findUsuariosRezagados(99, 0);
    expect(res.length).toBe(0);
  });

  test('usuario con minuto 30 solo matchea con (hora, 30), no con (hora, 0)', async () => {
    const tiendaId = new mongoose.Types.ObjectId();
    const usuarioMin30 = await Usuario.create({
      nombre: 'Usuario Min 30',
      email: 'min30@test.com',
      password_hash: 'hash',
      tienda_id: tiendaId,
      hora_recordatorio_utc: 10,
      minuto_recordatorio_utc: 30
    });
    await PlanProgreso.create({ tienda_id: tiendaId, codigo_utilizado: 'TEST', estado: 'activo', dia_actual: 1, usuario_id: usuarioMin30._id });

    const res30 = await findUsuariosRezagados(10, 30);
    expect(res30.map(u => u.usuario_id.toString())).toContain(usuarioMin30._id.toString());

    const res0 = await findUsuariosRezagados(10, 0);
    expect(res0.map(u => u.usuario_id.toString())).not.toContain(usuarioMin30._id.toString());
  });
});

describe('send-reminders - deduplicación', () => {
  let data;
  let app;

  beforeAll(async () => {
    app = require('../src/app');
  });

  beforeEach(async () => {
    data = await seed();
  });

  test('no duplica envíos en el mismo día calendario UTC', async () => {
    const usuario = data.usuario;

    const ahora = new Date();
    const minutoExacto = ahora.getUTCMinutes();
    await Usuario.collection.updateOne(
      { _id: usuario._id },
      { $set: { hora_recordatorio_utc: ahora.getUTCHours(), minuto_recordatorio_utc: minutoExacto } }
    );

    const tiendaId = new mongoose.Types.ObjectId();
    await PlanProgreso.create({
      usuario_id: usuario._id,
      tienda_id: tiendaId,
      codigo_utilizado: 'DEDUP-001',
      estado: 'activo',
      dia_actual: 1
    });

    await HistorialCorreo.create({
      usuario_id: usuario._id,
      email_destino: usuario.email,
      tipo_correo: 'recordatorio_diario',
      estado: 'enviado',
      fecha_envio: new Date()
    });

    const res = await request(app)
      .post('/api/jobs/send-reminders')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.saltados).toBeGreaterThanOrEqual(1);
    expect(res.body.enviados).toBe(0);
  });
});
