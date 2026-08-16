const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('../src/models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ien';
const CRON_API_KEY = 'm4h_RNGqd-1ELFMqJ_m6yaa0EqzXmHreDJQkKoHwUHI';
const TEST_EMAIL = 'tadeofrr13@gmail.com';

const Tienda = mongoose.model('Tienda');
const Producto = mongoose.model('Producto');
const Codigo = mongoose.model('Codigo');
const Usuario = mongoose.model('Usuario');
const PlanProgreso = mongoose.model('PlanProgreso');

function post(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3000, path: `/api/jobs${path}`,
      method: 'POST',
      headers: { 'x-api-key': CRON_API_KEY, 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`\n=== POST /api/jobs${path} → ${res.statusCode} ===`);
        try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
        catch { console.log(data); }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (ien)');

  // Limpiar datos de prueba anteriores
  const suffix = 'jobs-test';
  await Usuario.deleteMany({ email: { $regex: '^tadeofrr13\\+' } });
  console.log('Cleaned existing test users');

  // Crear tienda, producto, código
  const tienda = await Tienda.create({ nombre_tienda: 'Tienda Jobs Test', ciudad: 'Ciudad Test' });
  const producto = await Producto.create({ nombre: 'Producto Jobs Test', tienda_id: tienda._id });
  const codigo = await Codigo.create({
    codigo: `JOBS-${Date.now()}`,
    producto_id: producto._id,
    tienda_id: tienda._id,
    activo: true
  });
  console.log(`Tienda: ${tienda._id}, Producto: ${producto._id}, Código: ${codigo.codigo}`);

  const hash = await bcrypt.hash('test123', 4);

  // ─── USUARIO 1: REZAGADO (no completó hoy) ─── para send-reminders
  const user1 = await Usuario.create({
    nombre: 'Tadeo Rezagado',
    email: 'tadeofrr13+rezagado@gmail.com',
    password_hash: hash,
    rol: 'usuario',
    tienda_id: tienda._id,
    producto_id: producto._id,
    codigo_activacion: codigo.codigo,
    fecha_registro: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  });
  console.log(`User1 (rezagado): ${user1._id}`);

  // Plan activo, dia_actual=2, último día NO completado, última actividad hace 2 días
  const progreso1 = Array.from({ length: 30 }, (_, i) => ({
    dia_numero: i + 1,
    completado: i === 0, // solo dia 1 completado
    fecha_completado: i === 0 ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null,
    respuesta_usuario: null
  }));

  await PlanProgreso.create({
    usuario_id: user1._id,
    tienda_id: tienda._id,
    codigo_utilizado: codigo.codigo,
    fecha_inicio: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    dia_actual: 2,
    racha_dias: 1,
    racha_maxima: 1,
    hitos_alcanzados: [],
    ultima_fecha_actividad: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // hace 2 días
    estado: 'activo',
    progreso_diario: progreso1
  });
  console.log('Plan1 creado (rezagado, racha=1, última actividad hace 2 días)');

  // ─── USUARIO 2: SIN ACTIVAR ─── para send-activation-nudge
  const user2 = await Usuario.create({
    nombre: 'Tadeo Sin Activar',
    email: 'tadeofrr13+sinactivar@gmail.com',
    password_hash: hash,
    rol: 'usuario',
    tienda_id: tienda._id,
    producto_id: producto._id,
    codigo_activacion: codigo.codigo,
    fecha_registro: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // hace 10 días
  });
  console.log(`User2 (sin activar): ${user2._id}`);
  // NO creamos PlanProgreso para este usuario

  // ─── USUARIO 3: INACTIVO 8+ DÍAS ─── para send-recovery y reset-streaks
  const user3 = await Usuario.create({
    nombre: 'Tadeo Inactivo',
    email: 'tadeofrr13+inactivo@gmail.com',
    password_hash: hash,
    rol: 'usuario',
    tienda_id: tienda._id,
    producto_id: producto._id,
    codigo_activacion: codigo.codigo,
    fecha_registro: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  });
  console.log(`User3 (inactivo): ${user3._id}`);

  const progreso3 = Array.from({ length: 30 }, (_, i) => ({
    dia_numero: i + 1,
    completado: i < 3, // dias 1-3 completados
    fecha_completado: i < 3 ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null,
    respuesta_usuario: null
  }));

  await PlanProgreso.create({
    usuario_id: user3._id,
    tienda_id: tienda._id,
    codigo_utilizado: codigo.codigo,
    fecha_inicio: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    dia_actual: 4,
    racha_dias: 3,
    racha_maxima: 3,
    hitos_alcanzados: [],
    ultima_fecha_actividad: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // hace 10 días
    estado: 'activo',
    progreso_diario: progreso3
  });
  console.log('Plan3 creado (inactivo 10 días, racha=3, día actual=4)');

  console.log('\n──────────────────────────────────────────');
  console.log('DATOS CREADOS, DISPARANDO JOBS...');
  console.log('──────────────────────────────────────────');

  // Disparar cada job
  await post('/reset-streaks');
  await post('/send-reminders');
  await post('/send-activation-nudge');
  await post('/send-recovery');

  console.log('\n──────────────────────────────────────────');
  console.log('TODOS LOS JOBS DISPARADOS');
  console.log('Revisa la bandeja de', TEST_EMAIL);
  console.log('──────────────────────────────────────────');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
