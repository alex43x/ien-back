/**
 * Script de prueba: simula el flujo completo de un usuario
 * Uso: node src/test-flow.js
 */

const http = require('http');

const BASE = 'http://localhost:3000/api';

async function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('\n=== 1. Validar código ===');
  let res = await request('POST', '/auth/validate-code', { codigo_activacion: 'IEN-001' });
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 2. Registrar usuario ===');
  const email = `juan_${Date.now()}@test.com`;
  res = await request('POST', '/auth/register', {
    nombre: 'Juan Pérez',
    email,
    password: 'password123',
    codigo_activacion: 'IEN-001'
  });
  console.log(res.status, JSON.stringify(res.data, null, 2));
  const token = res.data.access_token;
  const authHeader = { Authorization: `Bearer ${token}` };

  console.log('\n=== 2b. Obtener preguntas de diagnóstico ===');
  res = await request('GET', '/plan/test-preguntas', null, authHeader);
  console.log(res.status, `Recibidas ${res.data.length} preguntas`);

  // Crear 30 respuestas de test válidas:
  // Autoconciencia y Autocontrol darán < 20 (score 3)
  // Las demás darán score 5 (para dar 25 total)
  const respuestas = res.data.map(p => {
    let score = 5;
    if (p.competencia === 'autoconciencia' || p.competencia === 'autocontrol') {
      score = 3;
    }
    return { numero: p.numero, score };
  });

  console.log('\n=== 3. Setup test inicial ===');
  res = await request('POST', '/plan/setup-test', { respuestas }, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 3b. Intentar llamar setup-test de nuevo (debe fallar 409) ===');
  const resDup = await request('POST', '/plan/setup-test', { respuestas }, authHeader);
  console.log(resDup.status, JSON.stringify(resDup.data, null, 2));

  console.log('\n=== 4. Contenido de hoy ===');
  res = await request('GET', '/plan/today', null, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 5. Perfil (día 1, racha:0, completados:0) ===');
  res = await request('GET', '/plan/profile', null, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 6. Completar día (con respuesta de ejercicio) ===');
  const respuesta_usuario = {
    tipo_ejercicio: 'reflexion',
    respuestas_escaneadas: ['Nivel energía 7', 'Ligera tensión en cuello']
  };
  res = await request('POST', '/plan/complete-day', { respuesta_usuario }, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 7. Today después de completar (mismo día → leccion: null) ===');
  res = await request('GET', '/plan/today', null, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 8. Perfil después de completar (día 2, racha:1, completados:1) ===');
  res = await request('GET', '/plan/profile', null, authHeader);
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 9. Login ===');
  res = await request('POST', '/auth/login', { email, password: '123456' });
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 10. Admin: métricas ===');
  const adminRes = await request('POST', '/auth/login', { email: 'admin@ien.test', password: 'admin123' });
  const adminToken = adminRes.data.access_token;
  res = await request('GET', '/admin/dashboard/metrics', null, { Authorization: `Bearer ${adminToken}` });
  console.log(res.status, JSON.stringify(res.data, null, 2));

  console.log('\n=== 11. Jobs: reset rachas (con API key incorrecta) ===');
  res = await request('POST', '/jobs/reset-streaks', null, { 'x-api-key': 'wrong-key' });
  console.log(res.status, JSON.stringify(res.data, null, 2));
}

main().catch(console.error);
