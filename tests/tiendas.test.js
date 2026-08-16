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

describe('Sucursales - admin_general', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/sucursales - list all', async () => {
    const res = await request(app)
      .get('/api/admin/sucursales')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('POST /api/admin/sucursales - create', async () => {
    const res = await request(app)
      .post('/api/admin/sucursales')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre_tienda: 'Nueva Sucursal', ciudad: 'Cali' });
    expect(res.status).toBe(201);
    expect(res.body.nombre_tienda).toBe('Nueva Sucursal');
  });

  test('POST /api/admin/sucursales - missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/sucursales')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre_tienda: 'Solo nombre' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/admin/sucursales/:id - update', async () => {
    const res = await request(app)
      .put(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ciudad: 'Barranquilla' });
    expect(res.status).toBe(200);
    expect(res.body.ciudad).toBe('Barranquilla');
  });

  test('DELETE /api/admin/sucursales/:id - delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('PATCH /api/admin/sucursales/:id/reactivar - success', async () => {
    await request(app)
      .delete(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/admin/sucursales/${data.tienda1Id}/reactivar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/reactivada/i);
  });
});

describe('Sucursales - admin_negocio (scoped)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminNegocio);
  });

  test('GET /api/admin/sucursales - scoped to assigned stores', async () => {
    const res = await request(app)
      .get('/api/admin/sucursales')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(data.tienda1Id);
  });

  test('POST /api/admin/sucursales - forbidden for admin_negocio', async () => {
    const res = await request(app)
      .post('/api/admin/sucursales')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre_tienda: 'X', ciudad: 'Y' });
    expect(res.status).toBe(403);
  });

  test('PATCH /api/admin/sucursales/:id/reactivar - forbidden fuera de scope', async () => {
    const res = await request(app)
      .patch(`/api/admin/sucursales/${data.tienda2Id}/reactivar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Sucursales - no auth', () => {
  test('GET /api/admin/sucursales - 401 without token', async () => {
    const res = await request(app).get('/api/admin/sucursales');
    expect(res.status).toBe(401);
  });
});
