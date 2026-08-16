/**
 * Script de testing aislado para demoledorDeRachas().
 * Crea 10 planes de prueba con fechas/estados/rachas exactas,
 * ejecuta demoledorDeRachas(), valida resultados, y limpia la DB.
 *
 * Ejecución: node scripts/test-demoledor.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Tienda = require('../src/models/Tienda');
const Usuario = require('../src/models/Usuario');
const PlanProgreso = require('../src/models/PlanProgreso');
const { demoledorDeRachas } = require('../src/modules/jobs/cronJobs');
const { getInicioDeDiaDeAyer } = require('../src/utils/fechas');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBefore(date, days) {
  return new Date(date.getTime() - days * 86400000);
}

function daysAfter(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function fmt(date) {
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Casos de prueba
// ---------------------------------------------------------------------------

function buildCasos(inicioDeAyer) {
  const ahora = new Date();
  const ayerFin = new Date(inicioDeAyer.getTime() + 86400000 - 1);
  const anteayer = daysBefore(inicioDeAyer, 1);
  const hace3Dias = daysBefore(inicioDeAyer, 2);
  const hace5Dias = daysBefore(inicioDeAyer, 4);
  const hace10Dias = daysBefore(inicioDeAyer, 9);

  return [
    { id: 1, email: 'test-demoledor-caso-1@test.local',  estado: 'activo',     racha: 5,  fecha: ahora,             reseteaEsperado: false },
    { id: 2, email: 'test-demoledor-caso-2@test.local',  estado: 'activo',     racha: 5,  fecha: ayerFin,           reseteaEsperado: false },
    { id: 3, email: 'test-demoledor-caso-3@test.local',  estado: 'activo',     racha: 5,  fecha: inicioDeAyer,      reseteaEsperado: false },
    { id: 4, email: 'test-demoledor-caso-4@test.local',  estado: 'activo',     racha: 5,  fecha: new Date(inicioDeAyer.getTime() - 1), reseteaEsperado: true },
    { id: 5, email: 'test-demoledor-caso-5@test.local',  estado: 'activo',     racha: 5,  fecha: anteayer,          reseteaEsperado: true },
    { id: 6, email: 'test-demoledor-caso-6@test.local',  estado: 'activo',     racha: 0,  fecha: hace10Dias,        reseteaEsperado: false },
    { id: 7, email: 'test-demoledor-caso-7@test.local',  estado: 'completado', racha: 5,  fecha: hace5Dias,         reseteaEsperado: false },
    { id: 8, email: 'test-demoledor-caso-8@test.local',  estado: 'abandonado', racha: 5,  fecha: hace5Dias,         reseteaEsperado: false },
    { id: '9a', email: 'test-demoledor-caso-9a@test.local', estado: 'activo', racha: 3,  fecha: hace3Dias,         reseteaEsperado: true },
    { id: '9b', email: 'test-demoledor-caso-9b@test.local', estado: 'activo', racha: 7,  fecha: hace3Dias,         reseteaEsperado: true },
    { id: '9c', email: 'test-demoledor-caso-9c@test.local', estado: 'activo', racha: 12, fecha: hace3Dias,         reseteaEsperado: true },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');

  const inicioDeAyer = getInicioDeDiaDeAyer();
  console.log(`Inicio de ayer (UTC): ${fmt(inicioDeAyer)}`);

  const passwordHash = await bcrypt.hash('test123', 10);
  const tienda = await Tienda.create({ nombre_tienda: 'Tienda Test Demoledor', ciudad: 'Test City' });
  console.log(`Tienda creada: ${tienda._id}`);

  const casos = buildCasos(inicioDeAyer);
  const creados = []; // { caso, usuario, plan }

  // --- Paso 2: crear usuarios y planes ---
  for (const caso of casos) {
    const usuario = await Usuario.create({
      nombre: `Test Caso ${caso.id}`,
      email: caso.email,
      password_hash: passwordHash,
    });

    const plan = await PlanProgreso.create({
      usuario_id: usuario._id,
      tienda_id: tienda._id,
      codigo_utilizado: 'TEST-DEMO',
      racha_dias: caso.racha,
      racha_maxima: caso.racha,
      ultima_fecha_actividad: caso.fecha,
      estado: caso.estado,
    });

    creados.push({ caso, usuario, plan });
  }
  console.log(`${creados.length} usuarios + planes creados`);

  // --- Paso 3: ejecutar demoledorDeRachas ---
  console.log('\n--- Ejecutando demoledorDeRachas() ---');
  const resultado = await demoledorDeRachas();
  console.log('matchedCount:', resultado.matchedCount);
  console.log('modifiedCount:', resultado.modifiedCount);
  console.log('usuarios_afectados:', JSON.stringify(resultado.usuarios_afectados, null, 2));

  // --- Paso 4: validar resultados ---
  console.log('\n=== Tabla de resultados ===');
  console.log('| Caso | Estado     | Racha | Fecha             | Esperado    | Real         |    |');
  console.log('|------|------------|-------|-------------------|-------------|--------------|----|');

  let pasados = 0;
  let fallados = [];
  const idsAfectados = new Set(
    resultado.usuarios_afectados.map(u => String(u.usuario_id))
  );

  for (const { caso, usuario, plan } of creados) {
    const planActual = await PlanProgreso.findById(plan._id).lean();
    const rachaActual = planActual.racha_dias;
    const usuarioAfectado = idsAfectados.has(String(usuario._id));

    let realResetea = usuarioAfectado;
    let esperado;

    if (caso.reseteaEsperado) {
      esperado = `Resetea a 0`;
      const pass = rachaActual === 0 && realResetea;
      if (pass) pasados++; else fallados.push(caso);
      const rachaReal = `racha=${rachaActual}`;
      const icon = pass ? '✅' : '❌';
      console.log(`| ${String(caso.id).padEnd(4)} | ${caso.estado.padEnd(10)} | ${String(caso.racha).padStart(5)} | ${fmt(caso.fecha).padEnd(17)} | ${esperado.padEnd(11)} | ${rachaReal.padEnd(12)} | ${icon} |`);
    } else {
      esperado = `Sin cambio (${caso.racha})`;
      const pass = rachaActual === caso.racha && !realResetea;
      if (pass) pasados++; else fallados.push(caso);
      const rachaReal = `racha=${rachaActual}`;
      const icon = pass ? '✅' : '❌';
      console.log(`| ${String(caso.id).padEnd(4)} | ${caso.estado.padEnd(10)} | ${String(caso.racha).padStart(5)} | ${fmt(caso.fecha).padEnd(17)} | ${esperado.padEnd(18)} | ${rachaReal.padEnd(12)} | ${icon} |`);
    }
  }

  console.log(`\n=== Pass: ${pasados}/${creados.length} ===`);

  // --- Paso 5: diagnosticar fallos ---
  if (fallados.length > 0) {
    console.log('\n--- Diagnosticando fallos ---');
    for (const caso of fallados) {
      const entry = creados.find(c => c.caso.id === caso.id);
      const planActual = await PlanProgreso.findById(entry.plan._id).lean();
      console.log(`\nCaso ${caso.id} FALLÓ. Documento actual en Mongo:`);
      console.log(JSON.stringify(planActual, null, 2));
    }
  }

  // --- Paso 6: cleanup ---
  console.log('\nLimpiando datos de prueba...');
  const usuarioIds = creados.map(c => c.usuario._id);
  const planIds = creados.map(c => c.plan._id);
  await PlanProgreso.deleteMany({ _id: { $in: planIds } });
  await Usuario.deleteMany({ _id: { $in: usuarioIds } });
  await Tienda.deleteOne({ _id: tienda._id });
  console.log(`${creados.length} usuarios, ${creados.length} planes, 1 tienda eliminados`);

  await mongoose.disconnect();
  console.log('Desconectado de MongoDB');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
