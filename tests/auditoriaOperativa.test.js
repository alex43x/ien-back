const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Plan = require('../src/models/PlanProgreso');
const { provision, verifyStorage } = require('../src/modules/auditoria/storage');
const { drain, limit } = require('../src/modules/auditoria/operativa');
const { archivarYReiniciar } = require('../src/modules/plan/reinicios.service');
const { demoledorDeRachas } = require('../src/modules/jobs/cronJobs');
const { waitForObservations } = require('../src/modules/auditoria/auditoria');

let db;
beforeAll(async () => {
  process.env.AUDIT_MODE = 'operativa';
  const uri = new URL(process.env.MONGO_TEST_URI);
  if (uri.hostname !== '127.0.0.1') throw new Error('Se requiere npm test local');
  await mongoose.connect(uri.toString(), { dbName: 'admin' });
  db = mongoose.connection.db;
  await provision(db);
  await verifyStorage(db, mongoose.connection.getClient());
});
afterAll(async () => {
  delete process.env.AUDIT_MODE;
  await waitForObservations();
  await mongoose.disconnect();
});

async function fixture() {
  return Plan.create({ usuario_id: new mongoose.Types.ObjectId(), tienda_id: new mongoose.Types.ObjectId(),
    codigo_utilizado: 'prueba', fecha_inicio: new Date('2020-01-01'), ultima_fecha_actividad: new Date('2020-02-01'),
    dia_actual: 20, racha_dias: 19, racha_maxima: 19 });
}

test('reinicio concurrente, reinicio del copiador y reentrega en admin', async () => {
  const plan = await fixture();
  const reset = () => archivarYReiniciar(plan, 'inactividad', new Date());
  const results = await Promise.all([reset(), reset()]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.find(Boolean).toJSON()).not.toHaveProperty('auditoria_pendiente');
  const stored = await Plan.collection.findOne({ _id: plan._id });
  const [event] = stored.auditoria_pendiente;
  expect(event).toMatchObject({ evento: 'plan_reiniciado', anterior: { racha_dias: 19 }, posterior: { racha_dias: 0 } });
  const events = db.collection('eventos_auditoria');
  await events.insertOne(event); // caída entre copia y limpieza
  await Promise.all([drain(db), drain(db)]);
  expect(await events.countDocuments({ _id: event._id })).toBe(1);
  expect(await Plan.collection.findOne({ _id: plan._id })).not.toHaveProperty('auditoria_pendiente');
});

test('el día completado queda vinculado al usuario y no copia su respuesta', async () => {
  const { completeDay } = require('../src/modules/plan/plan.service');
  const plan = await fixture();
  const response = await completeDay(plan.usuario_id, 'RESPUESTA_PRIVADA');
  expect(response).toMatchObject({ dia_completado: 20, dia_actual: 21 });
  await drain(db);
  const event = await db.collection('eventos_auditoria').findOne({ usuario_id: plan.usuario_id, evento: 'actividad_completada' });
  expect(event).toMatchObject({ actor_id: plan.usuario_id, posterior: { dia_actual: 21 } });
  expect(JSON.stringify(event)).not.toContain('RESPUESTA_PRIVADA');
});

test('una cola llena permite cambiar la racha y conserva todos los pendientes', async () => {
  const plan = await fixture();
  const pending = Array.from({ length: limit }, () => ({ _id: randomUUID() }));
  await Plan.collection.updateOne({ _id: plan._id }, { $set: { auditoria_pendiente: pending } });
  await demoledorDeRachas();
  const stored = await Plan.collection.findOne({ _id: plan._id });
  expect(stored.racha_dias).toBe(0);
  expect(stored.auditoria_pendiente).toEqual(pending);
});
