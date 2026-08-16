const request = require('supertest');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken } = require('./helpers/auth');
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

describe('Plan - test-preguntas & bienvenida', () => {
  let token;
  beforeEach(async () => {
    const data = await seed();
    token = generateToken(data.usuario);
  });

  test('GET /api/plan/test-preguntas - returns questions', async () => {
    const res = await request(app)
      .get('/api/plan/test-preguntas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(12);
  });

  test('GET /api/plan/test-preguntas - no token', async () => {
    const res = await request(app).get('/api/plan/test-preguntas');
    expect(res.status).toBe(401);
  });

  test('GET /api/plan/bienvenida - returns content', async () => {
    const res = await request(app)
      .get('/api/plan/bienvenida')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Plan - setup-test & test-inicial', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.usuario);
  });

  test('POST /api/plan/setup-test - success', async () => {
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({
      numero: i + 1,
      score: Math.floor(Math.random() * 5) + 1
    }));
    const res = await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });
    expect(res.status).toBe(201);
    expect(res.body.plan_id).toBeDefined();
    expect(res.body.puntuaciones_por_competencia).toBeDefined();
  });

  test('POST /api/plan/setup-test - missing respuestas', async () => {
    const res = await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/plan/test-inicial - no plan yet', async () => {
    const res = await request(app)
      .get('/api/plan/test-inicial')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Plan - today, days, profile, complete-day', () => {
  let data, token, planId;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.usuario);
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({
      numero: i + 1,
      score: 3
    }));
    const setup = await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });
    planId = setup.body.plan_id;
  });

  test('GET /api/plan/today - returns today content', async () => {
    const res = await request(app)
      .get('/api/plan/today')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dia_actual).toBeDefined();
  });

  test('GET /api/plan/days - returns days', async () => {
    const res = await request(app)
      .get('/api/plan/days')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dias).toBeDefined();
    expect(Array.isArray(res.body.dias)).toBe(true);
  });

  test('GET /api/plan/days?completados=true - filter completed', async () => {
    const res = await request(app)
      .get('/api/plan/days?completados=true')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/plan/profile - returns profile', async () => {
    const res = await request(app)
      .get('/api/plan/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('activo');
  });

  test('POST /api/plan/complete-day - success', async () => {
    const res = await request(app)
      .post('/api/plan/complete-day')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuesta_usuario: { reflexion: 'Test reflection', estado_animo: 4 } });
    expect(res.status).toBe(200);
    expect(res.body.racha_dias).toBeDefined();
  });

  test('POST /api/plan/complete-day - double complete same day', async () => {
    await request(app)
      .post('/api/plan/complete-day')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuesta_usuario: { reflexion: 'Test', estado_animo: 4 } });
    const res = await request(app)
      .post('/api/plan/complete-day')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuesta_usuario: { reflexion: 'Test2', estado_animo: 3 } });
    expect(res.status).toBe(409);
  });

  test('GET /api/plan/test-inicial - after setup', async () => {
    const res = await request(app)
      .get('/api/plan/test-inicial')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.puntuaciones_por_competencia).toBeDefined();
  });
});

describe('Plan - testing endpoints', () => {
  let data, token;

  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.usuario);
  });

  test('POST /api/plan/testing/autocomplete-test - success', async () => {
    const res = await request(app)
      .post('/api/plan/testing/autocomplete-test')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.plan_id).toBeDefined();
  });

  test('POST /api/plan/testing/advance - success', async () => {
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({
      numero: i + 1, score: 3
    }));
    await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });

    const res = await request(app)
      .post('/api/plan/testing/advance')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/plan/testing/retreat - success', async () => {
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({
      numero: i + 1, score: 3
    }));
    await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });

    await request(app)
      .post('/api/plan/testing/advance')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/plan/testing/retreat')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dia_retrocedido).toBeDefined();
    expect(res.body.dia_actual).toBeDefined();
  });

  test('POST /api/plan/testing/retreat - 409 sin días completados', async () => {
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({
      numero: i + 1, score: 3
    }));
    await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });

    const res = await request(app)
      .post('/api/plan/testing/retreat')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
