const request = require('supertest');
const crypto = require('crypto');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { seed } = require('./helpers/seed');
const { generateToken } = require('./helpers/auth');
const mongoose = require('mongoose');
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

describe('Auth - validate-code', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('POST /api/auth/validate-code - valid code', async () => {
    const res = await request(app)
      .post('/api/auth/validate-code')
      .send({ codigo_activacion: data.codigo1 });
    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(res.body.tienda).toBeDefined();
    expect(res.body.producto).toBeDefined();
  });

  test('POST /api/auth/validate-code - invalid code', async () => {
    const res = await request(app)
      .post('/api/auth/validate-code')
      .send({ codigo_activacion: 'INVALID-CODE' });
    expect(res.status).toBe(404);
  });

  test('POST /api/auth/validate-code - missing field', async () => {
    const res = await request(app)
      .post('/api/auth/validate-code')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Auth - register', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('POST /api/auth/register - success', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Nuevo Usuario',
        email: 'nuevo@test.com',
        password: 'pass1234',
        codigo_activacion: data.codigo1
      });
    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.usuario.email).toBe('nuevo@test.com');
  });

  test('POST /api/auth/register - duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'User',
        email: 'dup@test.com',
        password: 'pass1234',
        codigo_activacion: data.codigo1
      });
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'User2',
        email: 'dup@test.com',
        password: 'pass1234',
        codigo_activacion: data.codigo1
      });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/register - missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Test' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register - invalid code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'User',
        email: 'x@test.com',
        password: 'pass1234',
        codigo_activacion: 'FAKE-CODE'
      });
    expect(res.status).toBe(404);
  });
});

describe('Auth - login', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('POST /api/auth/login - success', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: data.adminGeneral.email, password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
  });

  test('POST /api/auth/login - wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: data.adminGeneral.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('Auth - refresh & logout', () => {
  let data, refreshToken;
  beforeEach(async () => {
    data = await seed();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: data.adminGeneral.email, password: 'admin123' });
    refreshToken = res.body.refresh_token;
  });

  test('POST /api/auth/refresh - success', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
  });

  test('POST /api/auth/refresh - invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'invalid-token' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/logout - success', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(200);
  });

  test('POST /api/auth/logout - token already consumed (idempotent)', async () => {
    await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: refreshToken });
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(200);
  });
});

describe('Auth - profile', () => {
  let data, token;
  beforeEach(async () => {
    data = await seed();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: data.usuario.email, password: 'user123' });
    token = res.body.access_token;
  });

  test('GET /api/auth/profile - success', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(data.usuario.email);
    expect(res.body.rol).toBe('usuario');
  });

  test('GET /api/auth/profile - no token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/profile - invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });
});

describe('Auth - forgot-password', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('POST /api/auth/forgot-password - success', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: data.usuario.email });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();
  });

  test('POST /api/auth/forgot-password - non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'noexiste@test.com' });
    expect(res.status).toBe(200);
  });
});

describe('Auth - verify-reset-token', () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  test('GET /api/auth/verify-reset-token - valid token', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    await mongoose.model('PasswordResetToken').create({
      usuario_id: data.usuario._id,
      token_hash,
      fecha_expiracion: new Date(Date.now() + 15 * 60 * 1000)
    });

    const res = await request(app)
      .get('/api/auth/verify-reset-token')
      .query({ token });
    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(res.body.email).toBeDefined();
  });

  test('GET /api/auth/verify-reset-token - invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/verify-reset-token')
      .query({ token: 'token-invalido-12345' });
    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(false);
  });

  test('GET /api/auth/verify-reset-token - missing token', async () => {
    const res = await request(app)
      .get('/api/auth/verify-reset-token');
    expect(res.status).toBe(400);
  });
});

describe('Auth - reset-password', () => {
  let data;
  let token, token_hash;
  beforeEach(async () => {
    data = await seed();
    token = crypto.randomBytes(32).toString('hex');
    token_hash = crypto.createHash('sha256').update(token).digest('hex');
    await mongoose.model('PasswordResetToken').create({
      usuario_id: data.usuario._id,
      token_hash,
      fecha_expiracion: new Date(Date.now() + 15 * 60 * 1000)
    });
  });

  test('POST /api/auth/reset-password - success', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, nueva_password: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('Contraseña actualizada');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: data.usuario.email, password: 'newpassword123' });
    expect(loginRes.status).toBe(200);
  });

  test('POST /api/auth/reset-password - missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password - invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token-invalido-12345', nueva_password: 'newpass123' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password - expired token', async () => {
    const expToken = crypto.randomBytes(32).toString('hex');
    const expTokenHash = crypto.createHash('sha256').update(expToken).digest('hex');
    await mongoose.model('PasswordResetToken').create({
      usuario_id: data.usuario._id,
      token_hash: expTokenHash,
      fecha_expiracion: new Date(Date.now() - 1000)
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: expToken, nueva_password: 'newpass123' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password - already used token', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, nueva_password: 'firstpass123' });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, nueva_password: 'secondpass123' });
    expect(res.status).toBe(400);
  });
});

describe('Auth - change-password', () => {
    let data, token;
    beforeEach(async () => {
        data = await seed();
        token = generateToken(data.usuario);
    });

    test('POST /api/auth/change-password - success', async () => {
        const res = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ current_password: 'user123', nueva_password: 'newpass456' });
        expect(res.status).toBe(200);
        expect(res.body.mensaje).toMatch(/actualizada/i);

        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ email: data.usuario.email, password: 'newpass456' });
        expect(loginRes.status).toBe(200);
    });

    test('POST /api/auth/change-password - contraseña actual incorrecta', async () => {
        const res = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ current_password: 'wrongpass', nueva_password: 'newpass456' });
        expect(res.status).toBe(401);
    });

    test('POST /api/auth/change-password - campos faltantes', async () => {
        const res = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ current_password: 'user123' });
        expect(res.status).toBe(400);
    });
});
