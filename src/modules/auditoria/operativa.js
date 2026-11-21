const { isDeepStrictEqual } = require('node:util');
const { collectionName, validateEvent } = require('./schema');

const limit = 16;
const pendingPath = 'auditoria_pendiente.0._id';
const pendingIndex = { sparse: true, name: 'auditoria_pendiente' };

function operational() {
  const mode = process.env.AUDIT_MODE ?? 'transaccional';
  if (!['operativa', 'transaccional'].includes(mode)) throw new Error('AUDIT_MODE inválido');
  return mode === 'operativa';
}

// Esta etapa lee el estado resultante de las etapas anteriores del mismo update.
function appendStage(event) {
  const pending = { $ifNull: ['$auditoria_pendiente', []] };
  const entry = { $mergeObjects: [{ $literal: event }, { posterior: {
    dia_actual: '$dia_actual', estado: '$estado', racha_dias: '$racha_dias',
    racha_maxima: '$racha_maxima', ultima_fecha_actividad: '$ultima_fecha_actividad', version: '$__v'
  } }] };
  return { $set: { auditoria_pendiente: { $cond: [
    { $lt: [{ $size: pending }, limit] }, { $concatArrays: [pending, [entry]] }, pending
  ] } } };
}

async function drain(db) {
  const plans = db.collection('planes_progreso');
  const events = db.collection(collectionName);
  const cursor = plans.find({ [pendingPath]: { $exists: true } }, {
    projection: { auditoria_pendiente: 1 }, batchSize: 32
  });
  try {
    for await (const plan of cursor) {
      for (const event of plan.auditoria_pendiente) {
        try { validateEvent(event); }
        catch { console.error('auditoria_evento_invalido'); continue; }
        try {
          await events.insertOne(event, { writeConcern: { w: 'majority' } });
        } catch (error) {
          if (error.code !== 11000) throw error;
          const stored = await events.findOne({ _id: event._id }, { readConcern: { level: 'majority' } });
          if (!isDeepStrictEqual(stored, event)) {
            console.error('auditoria_copia_no_coincide');
            continue;
          }
        }
        await plans.updateOne({ _id: plan._id }, { $pull: { auditoria_pendiente: { _id: event._id } } });
      }
      await plans.updateOne({ _id: plan._id, auditoria_pendiente: { $size: 0 } }, { $unset: { auditoria_pendiente: '' } });
    }
  } finally {
    await cursor.close();
  }
}

function startDrain(db) {
  async function run() {
    try { await drain(db); }
    catch { console.error('auditoria_copia_pendiente'); }
    finally { setTimeout(run, 30000).unref(); }
  }
  void run();
}

module.exports = { operational, appendStage, startDrain, drain, limit, pendingPath, pendingIndex };
