const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken, createUsuario } = require('./helpers/auth');
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

describe('Pacientes - admin_general', () => {
  let data, token, usuario;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminGeneral);
    usuario = data.usuario;
  });

  test('GET /api/admin/pacientes - list patients', async () => {
    const res = await request(app)
      .get('/api/admin/pacientes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pacientes).toBeDefined();
    expect(Array.isArray(res.body.pacientes)).toBe(true);
    expect(res.body.total).toBeDefined();
  });

  test('GET /api/admin/pacientes?page=1&limit=10 - pagination', async () => {
    const res = await request(app)
      .get('/api/admin/pacientes?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagina).toBe(1);
  });

  test('GET /api/admin/pacientes/:usuarioId/perfil - patient profile', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/perfil`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(usuario.email);
  });

  test('GET /api/admin/pacientes/:usuarioId/perfil - not found', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/admin/pacientes/${fakeId}/perfil`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/pacientes/:usuarioId/progreso - no plan', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/progreso`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/pacientes/:usuarioId/test-inicial - no test', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/test-inicial`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/pacientes/:usuarioId/actividades - no plan', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/actividades`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Pacientes - admin_negocio (scoped)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.adminNegocio);
  });

  test('GET /api/admin/pacientes - scoped to assigned stores', async () => {
    const res = await request(app)
      .get('/api/admin/pacientes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/pacientes/:usuarioId/perfil - scoped patient', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${data.usuario._id}/perfil`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
