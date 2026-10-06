const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken } = require('./helpers/auth');
const { isValidEmail } = require('../src/utils/validators');
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

describe('SEG-01 ReDoS: validador de email acotado y sin backtracking cuadrático', () => {
  test('emails válidos comunes siguen pasando', () => {
    expect(isValidEmail('nuevo@test.com')).toBe(true);
    expect(isValidEmail('a.b@sub.dominio.com')).toBe(true);
    expect(isValidEmail('  user@test.com  ')).toBe(true);
  });

  test('emails inválidos se rechazan sin colgarse', () => {
    expect(isValidEmail('no-es-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });

  test('input de 254+ caracteres se rechaza por longitud', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.com`)).toBe(false);
  });

  test('payload ReDoS ("a@" + 64000 puntos + "@") responde rápido', () => {
    const payload = `a@${'.'.repeat(64000)}@`;
    const inicio = Date.now();
    expect(isValidEmail(payload)).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe('SEG-02 complete-day almacena respuesta_usuario literal (sin evaluar $)', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    token = generateToken(data.usuario);
    const respuestas = Array.from({ length: data.totalPreguntas }, (_, i) => ({ numero: i + 1, score: 3 }));
    const setup = await request(app)
      .post('/api/plan/setup-test')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuestas });
    expect(setup.status).toBe(201);
  });

  test('string "$codigo_utilizado" se guarda literal, no se evalúa como field-path', async () => {
    const res = await request(app)
      .post('/api/plan/complete-day')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuesta_usuario: '$codigo_utilizado' });
    expect(res.status).toBe(200);

    const dias = await request(app)
      .get('/api/plan/days?completados=true')
      .set('Authorization', `Bearer ${token}`);
    expect(dias.status).toBe(200);
    expect(dias.body.dias[0].respuesta_usuario).toBe('$codigo_utilizado');
  });

  test('respuesta legítima con "$" no se corrompe', async () => {
    const res = await request(app)
      .post('/api/plan/complete-day')
      .set('Authorization', `Bearer ${token}`)
      .send({ respuesta_usuario: '$100 ahorrados hoy' });
    expect(res.status).toBe(200);

    const dias = await request(app)
      .get('/api/plan/days?completados=true')
      .set('Authorization', `Bearer ${token}`);
    expect(dias.body.dias[0].respuesta_usuario).toBe('$100 ahorrados hoy');
  });
});

describe('SEG-03 solo admin_general puede cambiar grupo_id de sucursal', () => {
  let data, tokenNegocio, tokenGeneral;
  beforeEach(async () => {
    data = await seed();
    tokenNegocio = generateToken(data.adminNegocio);
    tokenGeneral = generateToken(data.adminGeneral);
  });

  test('admin_negocio recibe 403 y el grupo no cambia', async () => {
    const res = await request(app)
      .put(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ grupo_id: data.grupo2Id });
    expect(res.status).toBe(403);

    const Tienda = mongoose.model('Tienda');
    const tienda = await Tienda.findById(data.tienda1Id).lean();
    expect(tienda.grupo_id.toString()).toBe(data.grupo1Id);
  });

  test('admin_general sí puede mover la sucursal', async () => {
    const res = await request(app)
      .put(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${tokenGeneral}`)
      .send({ grupo_id: data.grupo2Id });
    expect(res.status).toBe(200);
  });

  test('admin_negocio puede seguir editando nombre/ciudad', async () => {
    const res = await request(app)
      .put(`/api/admin/sucursales/${data.tienda1Id}`)
      .set('Authorization', `Bearer ${tokenNegocio}`)
      .send({ ciudad: 'Cali' });
    expect(res.status).toBe(200);
    expect(res.body.ciudad).toBe('Cali');
  });
});

describe('SEG-06 forgot-password con tope por destinatario', () => {
  let data;
  beforeEach(async () => {
    data = await seed();
  });

  test('dos pedidos seguidos devuelven 200 pero crean un solo token', async () => {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    const r1 = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    const r2 = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.mensaje).toBe(r2.body.mensaje);

    const count = await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id });
    expect(count).toBe(1);
  });

  test('tope diario de 5 tokens por cuenta', async () => {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    const crypto = require('crypto');
    const ahora = Date.now();
    // 5 tokens previos fuera del cooldown (10+ min) pero dentro de 24h
    const docs = Array.from({ length: 5 }, (_, i) => ({
      usuario_id: data.usuario._id,
      token_hash: crypto.createHash('sha256').update(`viejo-${data.uid}-${i}`).digest('hex'),
      fecha_creacion: new Date(ahora - (10 + i) * 60 * 1000),
      fecha_expiracion: new Date(ahora + 15 * 60 * 1000)
    }));
    await PasswordResetToken.insertMany(docs);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    expect(res.status).toBe(200);
    const count = await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id });
    expect(count).toBe(5);
  });
});

describe('SEG-05 login con email inexistente ejecuta bcrypt.compare', () => {
  test('misma respuesta 401 y bcrypt.compare invocado', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    try {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nadie-xyz@test.com', password: 'WrongPass123' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Credenciales inválidas' });
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('SEG-04 refresh concurrente solo concede una sesión', () => {
  let data;
  beforeEach(async () => {
    data = await seed();
  });

  test('8 redenciones concurrentes del mismo token: 1 gana, 7 fallan', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: data.usuario.email, password: 'user123' });
    expect(login.status).toBe(200);
    const rt = login.body.refresh_token;

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app).post('/api/auth/refresh').send({ refresh_token: rt })
      )
    );
    const oks = resultados.filter((r) => r.status === 200);
    const fallos = resultados.filter((r) => r.status === 401);
    expect(oks.length).toBe(1);
    expect(fallos.length).toBe(7);
  }, 30000);
});
