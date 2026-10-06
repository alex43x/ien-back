const request = require('supertest');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken, createAdminNegocio } = require('./helpers/auth');
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

  test('POST /api/admin/productos - create con grupo_id', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo Plan', descripcion: 'Desc', grupo_id: data.grupo1Id });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Nuevo Plan');
    expect(res.body.grupo_id).toBe(data.grupo1Id);
  });

  test('POST /api/admin/productos - admin_general sin grupo_id → 400', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo Plan', descripcion: 'Desc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('grupo_id es requerido');
  });

  test('POST /api/admin/productos - missing nombre', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Sin nombre' });
    expect(res.status).toBe(400);
  });

  test('POST /api/admin/productos - grupo inexistente → 400', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Test', grupo_id: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El grupo indicado no existe');
  });

  test('PUT /api/admin/productos/:id - update', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Plan Actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Plan Actualizado');
  });

  test('PUT /api/admin/productos/:id - admin_general puede reasignar grupo', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ grupo_id: data.grupo2Id });
    expect(res.status).toBe(200);
    expect(res.body.grupo_id).toBe(data.grupo2Id);
  });

  test('PUT /api/admin/productos/:id - grupo inexistente → 400', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ grupo_id: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El grupo indicado no existe');
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
});

describe('Productos - admin_negocio (scope por grupo)', () => {
  let data, tokenNegocio, tokenOtroNegocio;
  beforeEach(async () => {
    data = await seed();
    tokenNegocio = generateToken(data.adminNegocio);
    tokenOtroNegocio = generateToken(data.adminGeneral2);
  });

  test('GET /api/admin/productos - solo ve productos de su grupo', async () => {
    const res = await request(app)
      .get('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].grupo_id).toBeDefined();
    expect(res.body[0].grupo_id._id || res.body[0].grupo_id).toBe(data.grupo1Id);
  });

  test('POST /api/admin/productos - sin grupo_id en body: crea en su grupo', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Producto Scoped', descripcion: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.grupo_id).toBe(data.grupo1Id);
  });

  test('POST /api/admin/productos - ignora grupo_id ajeno del body y fuerza el propio', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Producto Intento', descripcion: 'Test', grupo_id: data.grupo2Id });
    expect(res.status).toBe(201);
    expect(res.body.grupo_id).toBe(data.grupo1Id);
  });

  test('PUT /api/admin/productos/:id - no accede al producto de otro grupo', async () => {
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

  test('PUT /api/admin/productos/:id - enviar grupo_id (aunque sea el propio) → 403', async () => {
    const res = await request(app)
      .put(`/api/admin/productos/${data.producto1Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ nombre: 'Reasignando', grupo_id: data.grupo1Id });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/grupo/i);
  });

  test('DELETE /api/admin/productos/:id - no puede eliminar producto de otro grupo', async () => {
    const res = await request(app)
      .delete(`/api/admin/productos/${data.producto2Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`);
    expect(res.status).toBe(403);
  });
});

describe('Productos - admin_negocio SIN grupo (fail closed)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    const huerfano = await createAdminNegocio(null);
    token = generateToken(huerfano);
  });

  test('GET /api/admin/productos - ve lista vacía, nunca el total', async () => {
    const res = await request(app)
      .get('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('POST /api/admin/productos - 403 aunque mande un grupo_id válido', async () => {
    const res = await request(app)
      .post('/api/admin/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'X', grupo_id: data.grupo1Id });
    expect(res.status).toBe(403);
  });
});
