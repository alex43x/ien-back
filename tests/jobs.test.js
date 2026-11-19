const request = require('supertest');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken } = require('./helpers/auth');
const PlanProgreso = require('../src/models/PlanProgreso');
const Usuario = require('../src/models/Usuario');
const HistorialCorreo = require('../src/models/HistorialCorreo');
const { demoledorDeRachas, findUsuariosRezagados, findPlanesParaAbandonar, findPlanesParaReiniciar } = require('../src/modules/jobs/cronJobs');
const { abandonarPlanesYNotificar, reiniciarPlanesYNotificar } = require('../src/modules/jobs/job.service');
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
      dia_actual: 2,
      racha_dias: 5,
      progreso_diario: [{ dia_numero: 1, completado: true, respuesta_usuario: { texto: 'Respuesta previa' } }],
      fecha_inicio: hace3Dias,
      ultima_fecha_actividad: hace3Dias
    });

    const res = await demoledorDeRachas();
    expect(res.modifiedCount).toBe(1);

    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.racha_dias).toBe(0);
    expect(plan.racha_rota_en).toBeInstanceOf(Date);
    expect(plan.dia_actual).toBe(2);
    expect(plan.progreso_diario[0].respuesta_usuario).toEqual({ texto: 'Respuesta previa' });
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

describe('findPlanesParaAbandonar - 30 días de inactividad', () => {
  beforeEach(async () => { await seed(); });

  async function crearPlanConAntiguedad(uid, dias, extra = {}) {
    return PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-ABN',
      estado: 'activo',
      fecha_inicio: new Date(Date.now() - (dias + 1) * 86400000),
      ultima_fecha_actividad: new Date(Date.now() - dias * 24 * 60 * 60 * 1000),
      ...extra
    });
  }

  test('solo devuelve planes activos con 30+ días sin actividad', async () => {
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    const u3 = new mongoose.Types.ObjectId();
    await Usuario.create({ _id: u1, nombre: 'A', email: 'a@test.com', password_hash: 'hash' });
    await Usuario.create({ _id: u2, nombre: 'B', email: 'b@test.com', password_hash: 'hash' });
    await Usuario.create({ _id: u3, nombre: 'C', email: 'c@test.com', password_hash: 'hash' });
    await crearPlanConAntiguedad(u1, 31);
    await crearPlanConAntiguedad(u2, 10);
    await crearPlanConAntiguedad(u3, 31, { estado: 'completado' });

    const res = await findPlanesParaAbandonar();
    const ids = res.map(r => r.usuario_id.toString());
    expect(ids).toContain(u1.toString());
    expect(ids).not.toContain(u2.toString());
    expect(ids).not.toContain(u3.toString());
  });
});

describe('abandonarPlanesYNotificar', () => {
  beforeEach(async () => { await seed(); });

  test('marca como abandonado un plan inactivo 30 días', async () => {
    const uid = new mongoose.Types.ObjectId();
    await Usuario.create({ _id: uid, nombre: 'A', email: 'a@test.com', password_hash: 'hash' });
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-ABN2',
      estado: 'activo',
      fecha_inicio: new Date(Date.now() - 32 * 86400000),
      ultima_fecha_actividad: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    });

    const res = await abandonarPlanesYNotificar();
    expect(res.abandonados).toBe(1);

    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.estado).toBe('abandonado');
  });
});

describe('reiniciarPlanesYNotificar - reset parcial', () => {
  beforeEach(async () => { await seed(); });

  test('reinciia dia y racha, conserva racha_maxima/hitos y no toca ultima_fecha_actividad', async () => {
    const uid = new mongoose.Types.ObjectId();
    await Usuario.create({ _id: uid, nombre: 'A', email: 'a@test.com', password_hash: 'hash' });
    const fechaVieja = new Date(Date.now() - 22 * 24 * 60 * 60 * 1000);
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-RST',
      estado: 'activo',
      dia_actual: 5,
      racha_dias: 4,
      racha_maxima: 14,
      hitos_alcanzados: [7, 14],
      fecha_inicio: fechaVieja,
      ultima_fecha_actividad: fechaVieja
    });

    const res = await reiniciarPlanesYNotificar();
    expect(res.reiniciados).toBe(1);

    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.dia_actual).toBe(1);
    expect(plan.racha_dias).toBe(0);
    expect(plan.racha_maxima).toBe(14);
    expect(plan.hitos_alcanzados).toEqual([7, 14]);
    expect(plan.ultima_fecha_actividad.getTime()).toBe(fechaVieja.getTime());
    expect(plan.progreso_diario.filter(d => d.completado).length).toBe(0);
  });

  test('no reinicia planes que siguen en el día 1', async () => {
    const uid = new mongoose.Types.ObjectId();
    await Usuario.create({ _id: uid, nombre: 'A', email: 'a@test.com', password_hash: 'hash' });
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-RST2',
      estado: 'activo',
      dia_actual: 1,
      fecha_inicio: new Date(Date.now() - 23 * 86400000),
      ultima_fecha_actividad: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000)
    });

    const res = await reiniciarPlanesYNotificar();
    expect(res.reiniciados).toBe(0);
  });
});

describe('reactivarSiAbandonado - reset completo al volver', () => {
  beforeEach(async () => { await seed(); });

  test('dos lecturas concurrentes reactivan el plan una vez y conservan sus respuestas', async () => {
    const { reactivarSiAbandonado } = require('../src/modules/plan/plan.service');
    const uid = new mongoose.Types.ObjectId();
    const anterior = await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-REA',
      estado: 'abandonado',
      dia_actual: 20,
      racha_dias: 3,
      racha_maxima: 28,
      hitos_alcanzados: [7, 14, 21],
      progreso_diario: [{ dia_numero: 1, completado: true, respuesta_usuario: { texto: 'Conservar' } }],
      ultima_fecha_actividad: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    });

    const [plan, otraLectura] = await Promise.all([reactivarSiAbandonado(uid), reactivarSiAbandonado(uid)]);
    expect(otraLectura._id).toEqual(plan._id);
    expect(plan.estado).toBe('activo');
    expect(plan.dia_actual).toBe(1);
    expect(plan.racha_dias).toBe(0);
    expect(plan.racha_maxima).toBe(0);
    expect(plan.hitos_alcanzados).toEqual([]);
    expect(plan.progreso_diario.filter(d => d.completado).length).toBe(0);
    const guardado = await PlanProgreso.findById(plan._id).select('+historial_reinicios').lean();
    expect(guardado.historial_reinicios).toEqual([expect.objectContaining({
      motivo: 'reactivacion', estado: 'abandonado', dia_actual: 20,
      progreso_diario: anterior.toObject().progreso_diario
    })]);
  });

  test('devuelve el plan activo sin reiniciarlo si ya está activo', async () => {
    const { reactivarSiAbandonado } = require('../src/modules/plan/plan.service');
    const uid = new mongoose.Types.ObjectId();
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-REA2',
      estado: 'activo',
      dia_actual: 3
    });
    const plan = await reactivarSiAbandonado(uid);
    expect(plan.dia_actual).toBe(3);
    const guardado = await PlanProgreso.findById(plan._id).select('+historial_reinicios').lean();
    expect(guardado.historial_reinicios).toBeUndefined();
  });
});

describe('run-daily - abandono antes que reinicio (AUD-04)', () => {
  beforeEach(async () => { await seed(); });

  async function crearPlanInactivo(dias, extra = {}) {
    const uid = new mongoose.Types.ObjectId();
    await Usuario.create({ _id: uid, nombre: 'Paciente', email: `p-${uid}@test.com`, password_hash: 'hash' });
    const progreso = Array.from({ length: 30 }, (_, i) => ({
      dia_numero: i + 1,
      completado: i < 4,
      fecha_completado: i < 4 ? new Date(Date.now() - (dias + 4 - i) * 86400000) : null,
      respuesta_usuario: i < 4 ? { reflexion: `respuesta del día ${i + 1}` } : null
    }));
    await PlanProgreso.create({
      usuario_id: uid,
      tienda_id: new mongoose.Types.ObjectId(),
      codigo_utilizado: 'TEST-RD',
      estado: 'activo',
      dia_actual: 5,
      racha_dias: 4,
      progreso_diario: progreso,
      fecha_inicio: new Date(Date.now() - (dias + 5) * 86400000),
      ultima_fecha_actividad: new Date(Date.now() - dias * 86400000),
      ...extra
    });
    return uid;
  }

  test('un plan con 31 días sin actividad se abandona sin borrar respuestas ni avisar "reiniciado" (5 corridas)', async () => {
    for (let corrida = 0; corrida < 5; corrida++) {
      await clearAll();
      await seed();
      const uid = await crearPlanInactivo(31);
      const res = await request(app)
        .post('/api/jobs/run-daily')
        .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
      expect(res.status).toBe(200);
      expect(res.body.abandon.abandonados).toBe(1);
      expect(res.body.restart.reiniciados).toBe(0);

      const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
      expect(plan.estado).toBe('abandonado');
      expect(plan.dia_actual).toBe(5);
      expect(plan.progreso_diario[0].respuesta_usuario).toEqual({ reflexion: 'respuesta del día 1' });

      const tipos = (await HistorialCorreo.find({ usuario_id: uid }).lean()).map(h => h.tipo_correo);
      expect(tipos).toContain('plan_abandonado');
      expect(tipos).not.toContain('plan_reiniciado');
    }
  });

  test('un plan con 22 días sin actividad se reinicia (no se abandona)', async () => {
    const uid = await crearPlanInactivo(22);
    const res = await request(app)
      .post('/api/jobs/run-daily')
      .set('X-Api-Key', process.env.CRON_API_KEY || 'test-api-key');
    expect(res.status).toBe(200);
    expect(res.body.abandon.abandonados).toBe(0);
    expect(res.body.restart.reiniciados).toBe(1);
    const plan = await PlanProgreso.findOne({ usuario_id: uid }).lean();
    expect(plan.estado).toBe('activo');
    expect(plan.dia_actual).toBe(1);
    expect(plan.historial_reinicios).toBeUndefined();
    const archivado = await PlanProgreso.findById(plan._id).select('+historial_reinicios').lean();
    expect(archivado.historial_reinicios).toEqual([expect.objectContaining({
      motivo: 'inactividad', fecha: expect.any(Date), dia_actual: 5, racha_dias: 4,
      progreso_diario: expect.arrayContaining([expect.objectContaining({
        dia_numero: 1, completado: true, respuesta_usuario: { reflexion: 'respuesta del día 1' }
      })])
    })]);
    const tipos = (await HistorialCorreo.find({ usuario_id: uid }).lean()).map(h => h.tipo_correo);
    expect(tipos).toContain('plan_reiniciado');
    expect(tipos).not.toContain('plan_abandonado');

    const auth = `Bearer ${generateToken({ _id: uid })}`;
    const [perfil, lectura] = await Promise.all([
      request(app).get('/api/plan/profile').set('Authorization', auth),
      request(app).get('/api/plan/today').set('Authorization', auth)
    ]);
    expect(perfil.status).toBe(200);
    expect(perfil.body).toMatchObject({ estado: 'activo', dia_actual: 1, dias_completados: 0 });
    expect(lectura.status).toBe(200);
    expect(lectura.body.leccion).toBeTruthy();
    const respuesta = [{ id: 'reflexion', tipo: 'texto', valor: 'Respuesta del nuevo recorrido' }];
    const completado = await request(app).post('/api/plan/complete-day').set('Authorization', auth)
      .send({ respuesta_usuario: respuesta });
    expect(completado.status).toBe(200);
    expect(completado.body).toMatchObject({ dia_completado: 1, dia_actual: 2 });
    const actualizado = await PlanProgreso.findById(plan._id).select('+historial_reinicios').lean();
    expect(actualizado.progreso_diario[0].respuesta_usuario).toEqual(respuesta);
    expect(actualizado.historial_reinicios).toEqual(archivado.historial_reinicios);
  });

  test('una actividad guardada después de seleccionar al candidato cancela el reinicio y el aviso', async () => {
    const uid = await crearPlanInactivo(22);
    const { completeDay } = require('../src/modules/plan/plan.service');
    const update = PlanProgreso.findOneAndUpdate.bind(PlanProgreso);
    const spy = jest.spyOn(PlanProgreso, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
      await completeDay(uid, [{ id: 'reflexion', tipo: 'texto', valor: 'Actividad recién guardada' }]);
      return update(...args);
    });
    try {
      const res = await reiniciarPlanesYNotificar();
      expect(res.total_candidatos).toBe(1);
      expect(res.reiniciados).toBe(0);
      expect(res.notificados).toBe(0);
      const plan = await PlanProgreso.findOne({ usuario_id: uid }).select('+historial_reinicios').lean();
      expect(plan.dia_actual).toBe(6);
      expect(plan.progreso_diario[4].respuesta_usuario[0].valor).toBe('Actividad recién guardada');
      expect(plan.historial_reinicios).toBeUndefined();
      const tipos = (await HistorialCorreo.find({ usuario_id: uid }).lean()).map(h => h.tipo_correo);
      expect(tipos).not.toContain('plan_reiniciado');
    } finally {
      spy.mockRestore();
    }
  });

  test('dos corridas concurrentes registran un solo reinicio', async () => {
    const uid = await crearPlanInactivo(22);
    const resultados = await Promise.all([reiniciarPlanesYNotificar(), reiniciarPlanesYNotificar()]);
    expect(resultados.reduce((total, r) => total + r.reiniciados, 0)).toBe(1);
    const plan = await PlanProgreso.findOne({ usuario_id: uid }).select('+historial_reinicios').lean();
    expect(plan.historial_reinicios).toHaveLength(1);
  });

  test('si el reinicio gana la carrera, un guardado ya en curso no modifica el día 1', async () => {
    const uid = await crearPlanInactivo(22);
    const update = PlanProgreso.findOneAndUpdate.bind(PlanProgreso);
    const spy = jest.spyOn(PlanProgreso, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
      expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(1);
      return update(...args);
    });
    try {
      const auth = `Bearer ${generateToken({ _id: uid })}`;
      const res = await request(app).post('/api/plan/complete-day').set('Authorization', auth)
        .send({ respuesta_usuario: [{ id: 'reflexion', tipo: 'texto', valor: 'Respuesta en curso' }] });
      expect(res.status).toBe(409);
      const plan = await PlanProgreso.findOne({ usuario_id: uid }).select('+historial_reinicios').lean();
      expect(plan.dia_actual).toBe(1);
      expect(plan.progreso_diario[0].respuesta_usuario).toBeNull();
      expect(plan.historial_reinicios).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('el mantenimiento ignora fechas de actividad anómalas', async () => {
    const uids = await Promise.all([
      crearPlanInactivo(8, { ultima_fecha_actividad: new Date(0), fecha_inicio: new Date(0) }),
      crearPlanInactivo(8, { fecha_inicio: new Date() }),
      crearPlanInactivo(8, { ultima_fecha_actividad: null }),
      crearPlanInactivo(8, { ultima_fecha_actividad: new Date(Date.now() + 86400000) })
    ]);
    expect((await abandonarPlanesYNotificar()).abandonados).toBe(0);
    expect((await reiniciarPlanesYNotificar()).reiniciados).toBe(0);
    expect((await demoledorDeRachas()).modifiedCount).toBe(0);
    const planes = await PlanProgreso.find({ usuario_id: { $in: uids } }).lean();
    expect(planes.every(plan => plan.dia_actual === 5 && plan.racha_dias === 4 && plan.estado === 'activo')).toBe(true);
  });
});

describe('findUsuariosSinActivar - solo pacientes (AUD-06)', () => {
  test('no incluye admins ni moderadores aunque no tengan plan', async () => {
    const data = await seed();
    const viejo = new Date(Date.now() - 10 * 86400000);
    await Usuario.updateMany({}, { $set: { fecha_registro: viejo } });
    const { findUsuariosSinActivar } = require('../src/modules/jobs/cronJobs');
    const resultado = await findUsuariosSinActivar();
    const ids = resultado.map(u => String(u._id));
    expect(ids).toContain(String(data.usuario._id));
    expect(ids).not.toContain(String(data.adminGeneral._id));
    expect(ids).not.toContain(String(data.adminNegocio._id));
    expect(ids).not.toContain(String(data.moderador._id));
  });
});
