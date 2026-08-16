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

describe('Productos - admin_general', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
  });

  test('GET /api/admin/productos - list all', async () => {
    const res = await request(app)
      .get('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('POST /api/admin/productos - create', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo Plan', descripcion: 'Desc', tienda_id: data.tienda1Id });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Nuevo Plan');
  });

  test('POST /api/admin/productos - missing nombre', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Sin nombre' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/admin/productos/:id - update', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Plan Actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Plan Actualizado');
  });

  test('DELETE /api/admin/productos/:id - delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/admin/productos/:id - not found', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/admin/productos/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/admin/productos - tienda_id inexistente → 400', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Test', tienda_id: fakeId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La tienda indicada no existe');
  });

  test('PUT /api/admin/productos/:id - cambiar a tienda_id inexistente → 400', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tienda_id: fakeId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La tienda indicada no existe');
  });
});

describe('Productos - admin_negocio (scoped)', () => {
  let data, tokenNegocio, tokenOtroNegocio;
  beforeEach(async () => {
    data = await seed();
    tokenNegocio = generateToken(data.adminNegocio);
    tokenOtroNegocio = generateToken(data.adminGeneral2);
  });

  test('GET /api/admin/productos - solo ve productos de su tienda', async () => {
    const res = await request(app)
      .get('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tienda_id).toBeDefined();
  });

  test('POST /api/admin/productos - con tienda_id dentro de scope', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Producto Scoped', descripcion: 'Test', tienda_id: data.tienda1Id });
    expect(res.status).toBe(201);
  });

  test('POST /api/admin/productos - con tienda_id fuera de scope → 403', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Producto Fuera', descripcion: 'Test', tienda_id: data.tienda2Id });
    expect(res.status).toBe(403);
  });

  test('PUT /api/admin/productos/:id - solo accede al de su tienda', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto2Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'No deberia funcionar' });
    expect(res.status).toBe(403);
  });

  test('PUT /api/admin/productos/:id - edita su propio producto', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Editado por admin_negocio' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/admin/productos/:id - no puede eliminar producto de otra tienda', async () => {
    const res = await request(app)
      .delete(`/api/admin/productos/${data.producto2Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`);
    expect(res.status).toBe(403);
  });
});
