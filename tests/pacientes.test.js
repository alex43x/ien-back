const request = require('supertest');
const mongoose = require('mongoose');
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

  test('busca por nombre antes de paginar y cuenta solo los resultados filtrados', async () => {
    await createUsuario({ nombre: 'Objetivo Norte', email: `norte-${data.uid}@test.com`, tienda_id: data.tiendas[0]._id });
    await createUsuario({ nombre: 'Objetivo Sur', email: `sur-${data.uid}@test.com`, tienda_id: data.tiendas[0]._id });
    const res = await request(app).get('/api/admin/pacientes')
      .query({ search: 'OBJETIVO', page: 2, limit: 1 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.pacientes).toHaveLength(1);
    expect(res.body.pacientes[0].nombre).toMatch(/Objetivo/);
    expect(res.body.pagina).toBe(2);
  });

  test('la búsqueda trata caracteres de expresiones regulares como texto literal', async () => {
    await mongoose.model('Usuario').findByIdAndUpdate(usuario._id, { nombre: 'Ana (Norte)' });
    const res = await request(app).get('/api/admin/pacientes')
      .query({ search: '(norte)' }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.pacientes[0].nombre).toBe('Ana (Norte)');
    const literal = await request(app).get('/api/admin/pacientes')
      .query({ search: '.*' }).set('Authorization', `Bearer ${token}`);
    expect(literal.body.total).toBe(0);
  });

  test('busca por correo electrónico sin distinguir mayúsculas', async () => {
    const res = await request(app).get('/api/admin/pacientes')
      .query({ search: usuario.email.toUpperCase() }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.pacientes[0].email).toBe(usuario.email);
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

  test('GET /api/admin/pacientes/:usuarioId/progreso - newly created patient without plan returns 200 and full default shape', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/progreso`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      estado: 'sin_iniciar',
      dia_actual: 0,
      racha_dias: 0,
      racha_maxima: 0,
      hitos_alcanzados: [],
      fecha_inicio: null,
      ultima_fecha_actividad: null,
      test_inicial: null,
      progreso_diario: []
    });
  });

  test('GET /api/admin/pacientes/:usuarioId/progreso - patient with progress returns plan data', async () => {
    const PlanProgreso = mongoose.model('PlanProgreso');
    await PlanProgreso.create({
      usuario_id: usuario._id,
      tienda_id: data.tiendas[0]._id,
      codigo_utilizado: data.codigo1,
      dia_actual: 5,
      racha_dias: 4,
      racha_maxima: 4,
      estado: 'activo'
    });

    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/progreso`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('activo');
    expect(res.body.dia_actual).toBe(5);
    expect(res.body.racha_dias).toBe(4);
    expect(res.body.racha_maxima).toBe(4);
    expect(Array.isArray(res.body.progreso_diario)).toBe(true);
    expect(res.body.progreso_diario.length).toBe(30);
  });

  test('GET /api/admin/pacientes/:usuarioId/progreso - non-existent patient returns 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/admin/pacientes/${fakeId}/progreso`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/pacientes/:usuarioId/test-inicial - no test', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/test-inicial`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/pacientes/:usuarioId/actividades - patient without plan returns empty array', async () => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${usuario._id}/actividades`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dias: [] });
  });

  test('GET /api/admin/pacientes/:usuarioId/actividades - non-existent patient returns 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/admin/pacientes/${fakeId}/actividades`)
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

describe('Pacientes - IDOR: admin de tienda A no lee paciente de tienda B', () => {
  let data, tokenA, pacienteB;

  beforeEach(async () => {
    data = await seed();
    tokenA = generateToken(data.adminNegocio);
    pacienteB = await createUsuario({
      nombre: 'Paciente Tienda B',
      email: `paciente-b-${data.uid}@test.com`,
      tienda_id: data.tiendas[1]._id,
      producto_id: data.productos[1]._id,
      codigo_activacion: data.codigo2
    });
  });

  const endpoints = ['perfil', 'progreso', 'actividades', 'test-inicial'];

  test('la búsqueda conserva el alcance de tiendas del administrador', async () => {
    const res = await request(app).get('/api/admin/pacientes')
      .query({ search: pacienteB.email }).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.pacientes).toEqual([]);
  });

  test.each(endpoints)('GET /api/admin/pacientes/:id/%s - 404 sin datos ajenos', async (recurso) => {
    const res = await request(app)
      .get(`/api/admin/pacientes/${pacienteB._id}/${recurso}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
    expect(res.body.email).toBeUndefined();
    expect(res.body.nombre).not.toBe(pacienteB.nombre);
    expect(res.body.test_inicial).toBeUndefined();
    expect(res.body.dias).toBeUndefined();
    expect(res.body.progreso_diario).toBeUndefined();
  });

  test('GET /api/admin/pacientes/:id/perfil - paciente sin tienda_id no es visible para admin scoped', async () => {
    const huérfano = await createUsuario({
      nombre: 'Paciente sin tienda',
      email: `huerfano-${data.uid}@test.com`
    });
    const res = await request(app)
      .get(`/api/admin/pacientes/${huérfano._id}/perfil`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
    expect(res.body.email).toBeUndefined();
  });
});
