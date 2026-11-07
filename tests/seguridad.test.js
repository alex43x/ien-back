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

  // AUD-02: el tope diario se cuenta sobre HistorialCorreo, porque el índice TTL
  // de password_reset_tokens borra cada token ~45 min después de creado.
  async function insertarEnviosPrevios(cantidad, minutosAtras) {
    const HistorialCorreo = mongoose.model('HistorialCorreo');
    const ahora = Date.now();
    await HistorialCorreo.insertMany(Array.from({ length: cantidad }, (_, i) => ({
      usuario_id: data.usuario._id,
      email_destino: data.usuario.email,
      tipo_correo: 'recuperacion_contrasena',
      estado: 'enviado',
      fecha_envio: new Date(ahora - (minutosAtras + i) * 60 * 1000)
    })));
  }

  test('tope diario: con 5 envíos en 24h no crea token aunque el TTL ya borró los tokens viejos', async () => {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    // Escenario real del bug: 5 correos enviados hace 1-2 h; sus tokens ya no existen.
    await insertarEnviosPrevios(5, 60);
    expect(await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id })).toBe(0);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('Si el email está registrado, recibirás un enlace de recuperación');
    expect(await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id })).toBe(0);
  });

  test('tope diario: con 4 envíos en 24h todavía permite uno más', async () => {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    await insertarEnviosPrevios(4, 60);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    expect(res.status).toBe(200);
    expect(await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id })).toBe(1);
  });

  test('tope diario: los envíos de hace más de 24h no cuentan', async () => {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    await insertarEnviosPrevios(5, 25 * 60);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: data.usuario.email });
    expect(res.status).toBe(200);
    expect(await PasswordResetToken.countDocuments({ usuario_id: data.usuario._id })).toBe(1);
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

describe('AUD-12 cambiar la contraseña invalida los links de recuperación pendientes', () => {
  const crypto = require('crypto');
  let data;
  beforeEach(async () => {
    data = await seed();
  });

  async function crearTokenReset(plano) {
    const PasswordResetToken = mongoose.model('PasswordResetToken');
    await PasswordResetToken.create({
      usuario_id: data.usuario._id,
      token_hash: crypto.createHash('sha256').update(plano).digest('hex'),
      fecha_expiracion: new Date(Date.now() + 15 * 60 * 1000)
    });
  }

  test('al usar un link de reset, el otro link pendiente deja de funcionar', async () => {
    await crearTokenReset('link-a-prueba');
    await crearTokenReset('link-b-prueba');

    const r1 = await request(app).post('/api/auth/reset-password')
      .send({ token: 'link-a-prueba', nueva_password: 'nuevaClave123' });
    expect(r1.status).toBe(200);

    const verif = await request(app).get('/api/auth/verify-reset-token').query({ token: 'link-b-prueba' });
    expect(verif.body.valido).toBe(false);
    const r2 = await request(app).post('/api/auth/reset-password')
      .send({ token: 'link-b-prueba', nueva_password: 'otraClave123' });
    expect(r2.status).toBe(400);
  });

  test('change-password también invalida links de reset pendientes', async () => {
    await crearTokenReset('link-c-prueba');
    const Usuario = mongoose.model('Usuario');
    await Usuario.updateOne({ _id: data.usuario._id }, { $set: { password_hash: await bcrypt.hash('actual1234', 4) } });

    const cambio = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${generateToken(data.usuario)}`)
      .send({ current_password: 'actual1234', nueva_password: 'nuevaClave123' });
    expect(cambio.status).toBe(200);

    const r = await request(app).post('/api/auth/reset-password')
      .send({ token: 'link-c-prueba', nueva_password: 'otraClave123' });
    expect(r.status).toBe(400);
  });
});
