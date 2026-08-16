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

describe('Admin - CRUD admin-negocio', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/usuarios/admin-negocio - list', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios/admin-negocio')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test('POST /api/admin/usuarios/admin-negocio - create', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/admin-negocio')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Nuevo Admin',
        email: 'nuevo-admin@test.com',
        password: 'admin123',
        tiendas_administradas: [data.tienda1Id]
      });
    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('admin_negocio');
  });

  test('POST /api/admin/usuarios/admin-negocio - missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/admin-negocio')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('GET /api/admin/usuarios/admin-negocio/:id - get one', async () => {
    const res = await request(app)
      .get(`/api/admin/usuarios/admin-negocio/${data.adminNegocio._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(data.adminNegocio.email);
  });

  test('PUT /api/admin/usuarios/admin-negocio/:id - update', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/admin-negocio/${data.adminNegocio._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Admin Actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Admin Actualizado');
  });

  test('DELETE /api/admin/usuarios/admin-negocio/:id - delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/usuarios/admin-negocio/${data.adminNegocio._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Admin - admin_negocio cannot manage other admins', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminNegocio);
  });

  test('GET /api/admin/usuarios/admin-negocio - forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios/admin-negocio')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/admin/usuarios/admin-negocio - forbidden', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/admin-negocio')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'X', email: 'x@test.com', password: 'pass1234', tiendas_administradas: [data.tienda1Id] });
    expect(res.status).toBe(403);
  });
});

describe('Admin - CRUD moderador-tienda', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/usuarios/moderador-tienda - list', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios/moderador-tienda')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/admin/usuarios/moderador-tienda - create', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/moderador-tienda')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Nuevo Mod',
        email: 'nuevo-mod@test.com',
        password: 'mod12345',
        tienda_id: data.tienda1Id
      });
    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('moderador_tienda');
  });

  test('POST /api/admin/usuarios/moderador-tienda - missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/moderador-tienda')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('GET /api/admin/usuarios/moderador-tienda/:id - get one', async () => {
    const res = await request(app)
      .get(`/api/admin/usuarios/moderador-tienda/${data.moderador._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(data.moderador.email);
  });

  test('PUT /api/admin/usuarios/moderador-tienda/:id - update', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/moderador-tienda/${data.moderador._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Mod Actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Mod Actualizado');
  });

  test('DELETE /api/admin/usuarios/moderador-tienda/:id - delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/usuarios/moderador-tienda/${data.moderador._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Admin - moderador cannot access admin CRUD (moderator portal only)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.moderador);
  });

  test('GET /api/admin/usuarios/moderador-tienda - forbidden for moderador', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios/moderador-tienda')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/admin/usuarios/moderador-tienda - forbidden for moderador', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios/moderador-tienda')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Mod2',
        email: `mod2-${Date.now()}@test.com`,
        password: 'mod12345',
        tienda_id: data.tienda1Id
      });
    expect(res.status).toBe(403);
  });
});
