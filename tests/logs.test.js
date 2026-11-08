const express = require('express');
const morgan = require('morgan');
const request = require('supertest');
const { sinQuery, registrarTokensMorgan, FORMATO_PRODUCCION } = require('../src/utils/morganFormat');

registrarTokensMorgan(morgan);

function appConLog(lineas) {
  const app = express();
  app.use(morgan(FORMATO_PRODUCCION, { stream: { write: (l) => lineas.push(l) } }));
  app.get('/api/auth/verify-reset-token', (_req, res) => res.json({ valido: false }));
  app.post('/api/auth/reset-password', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Logs HTTP de producción sin tokens (AUD-03)', () => {
  test('sinQuery quita la query string y respeta valores sin query', () => {
    expect(sinQuery('/a/b?token=x&y=1')).toBe('/a/b');
    expect(sinQuery('/a/b')).toBe('/a/b');
    expect(sinQuery(undefined)).toBeUndefined();
  });

  test('el token de verify-reset-token no aparece en la línea de log', async () => {
    const lineas = [];
    await request(appConLog(lineas)).get('/api/auth/verify-reset-token?token=TOKEN_SECRETO_URL');
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain('GET /api/auth/verify-reset-token HTTP/1.1');
    expect(lineas[0]).not.toContain('TOKEN_SECRETO_URL');
  });

  test('el token del Referer (página /reset-password?token=) no aparece en el log', async () => {
    const lineas = [];
    await request(appConLog(lineas))
      .post('/api/auth/reset-password')
      .set('Referer', 'https://ien.example/reset-password?token=TOKEN_SECRETO_REFERER')
      .send({});
    expect(lineas[0]).toContain('"https://ien.example/reset-password"');
    expect(lineas[0]).not.toContain('TOKEN_SECRETO_REFERER');
  });

  test('mantiene el resto de los campos de combined (método, status, user-agent)', async () => {
    const lineas = [];
    await request(appConLog(lineas)).get('/api/auth/verify-reset-token?token=x').set('User-Agent', 'agente-prueba');
    expect(lineas[0]).toMatch(/"GET \/api\/auth\/verify-reset-token HTTP\/1\.1" 200 /);
    expect(lineas[0]).toContain('"agente-prueba"');
  });
});
