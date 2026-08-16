const request = require('supertest');
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

describe('Reportes - admin_general', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/reportes/usuarios - user report', async () => {
    const res = await request(app)
      .get('/api/admin/reportes/usuarios')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.registrados).toBeDefined();
    expect(res.body.activos).toBeDefined();
    expect(res.body.registrados.total).toBeDefined();
  });

  test('GET /api/admin/reportes/usuarios/grafica-semanal - weekly chart', async () => {
    const res = await request(app)
      .get('/api/admin/reportes/usuarios/grafica-semanal')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(7);
  });
});

describe('Reportes - admin_negocio', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminNegocio);
  });

  test('GET /api/admin/reportes/usuarios - scoped report', async () => {
    const res = await request(app)
      .get('/api/admin/reportes/usuarios')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/reportes/usuarios/grafica-semanal - scoped chart', async () => {
    const res = await request(app)
      .get('/api/admin/reportes/usuarios/grafica-semanal')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Dashboard - admin_general', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/dashboard/metrics - success', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
