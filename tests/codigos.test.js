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

describe('Codigos - admin_general', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/codigos - list all', async () => {
    const res = await request(app)
      .get('/api/admin/codigos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('POST /api/admin/codigos - create', async () => {
    const res = await request(app)
      .post('/api/admin/codigos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'NEW-CODE-001', producto_id: data.producto1Id, tienda_id: data.tienda1Id });
    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe('NEW-CODE-001');
  });

  test('POST /api/admin/codigos - missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/codigos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'ONLY-CODE' });
    expect(res.status).toBe(400);
  });

  test('POST /api/admin/codigos - producto/tieda inconsistentes', async () => {
    const res = await request(app)
      .post('/api/admin/codigos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'MAL-001', producto_id: data.producto1Id, tienda_id: data.tienda2Id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El producto no pertenece a la tienda indicada');
  });

  test('PATCH /api/admin/codigos/:id/activar - activate', async () => {
    const Codigo = mongoose.model('Codigo');
    const cod = await Codigo.findOne({ codigo: data.codigo1 });
    const res = await request(app)
      .patch(`/api/admin/codigos/${cod._id}/activar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.codigo.activo).toBe(true);
  });

  test('PATCH /api/admin/codigos/:id/desactivar - deactivate', async () => {
    const Codigo = mongoose.model('Codigo');
    const cod = await Codigo.findOne({ codigo: data.codigo1 });
    const res = await request(app)
      .patch(`/api/admin/codigos/${cod._id}/desactivar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.codigo.activo).toBe(false);
  });
});

describe('Codigos - admin_negocio (scoped)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminNegocio);
  });

  test('GET /api/admin/codigos - scoped', async () => {
    const res = await request(app)
      .get('/api/admin/codigos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
