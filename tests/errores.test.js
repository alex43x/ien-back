const request = require('supertest');
const { connect, disconnect } = require('./helpers/db');
let app;

beforeAll(async () => {
  await connect();
  app = require('../src/app');
});

afterAll(async () => {
  await disconnect();
});

describe('errorHandler - errores del parser de JSON (AUD-05)', () => {
  test('body de más de 1 MiB responde 413 en JSON (antes 500)', async () => {
    const enorme = JSON.stringify({ respuesta_usuario: 'a'.repeat(1100 * 1024) });
    const res = await request(app)
      .post('/api/plan/complete-day')
      .set('Content-Type', 'application/json')
      .send(enorme);
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'El contenido enviado es demasiado grande' });
  });

  test('un body grande pero dentro del límite no dispara 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x@example.com', password: 'p'.repeat(500 * 1024) }));
    expect(res.status).not.toBe(413);
  });

  test('charset no soportado responde 415 en JSON (antes 500)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{"email":"x@example.com","password":"12345678"}');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Solicitud inválida' });
  });

  test('JSON malformado sigue respondiendo 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'JSON malformado' });
  });
});
