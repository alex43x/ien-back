const request = require('supertest');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { generateToken, createAdmin, createAdminNegocio } = require('./helpers/auth');
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

describe('Grupos - admin_general', () => {
  let token;
  beforeEach(async () => {
    const admin = await createAdmin();
    token = generateToken(admin);
  });

  test('POST /api/admin/grupos - crea grupo', async () => {
    const res = await request(app)
      .post('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Grupo Cardiosmile' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Grupo Cardiosmile');
  });

  test('GET /api/admin/grupos - lista grupos', async () => {
    await request(app)
      .post('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Grupo A' });

    const res = await request(app)
      .get('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nombre).toBe('Grupo A');
  });

  test('POST /api/admin/grupos - sin nombre devuelve 400', async () => {
    const res = await request(app)
      .post('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Grupos - admin_negocio sin acceso', () => {
  let token;
  beforeEach(async () => {
    const admin = await createAdminNegocio();
    token = generateToken(admin);
  });

  test('GET /api/admin/grupos - 403 para admin_negocio', async () => {
    const res = await request(app)
      .get('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/admin/grupos - 403 para admin_negocio', async () => {
    const res = await request(app)
      .post('/api/admin/grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('Grupos - no auth', () => {
  test('GET /api/admin/grupos - 401 sin token', async () => {
    const res = await request(app).get('/api/admin/grupos');
    expect(res.status).toBe(401);
  });
});
