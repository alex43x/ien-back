const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');
const { collectionName, retentionMs, asObjectId, validateEvent } = require('./schema');

const { operational, appendStage, limit } = require('./operativa');
const critical = new Set(['actividad_completada', 'racha_interrumpida', 'plan_reiniciado', 'plan_reactivado']);

const context = new AsyncLocalStorage();
const version = process.env.AUDIT_BUILD_VERSION || require('../../../package.json').version;
const maxPending = 16;
let pending = 0;
let anonymousWindow = 0;
let anonymousCount = 0;
let dropped = { escritura: 0, limite: 0, transaccion: 0 };

function reportLoss(reason) {
  dropped[reason]++;
}

const flush = setInterval(() => {
  if (Object.values(dropped).some(Boolean)) {
    console.error(JSON.stringify({ evento: 'auditoria_perdidas', ...dropped }));
    dropped = { escritura: 0, limite: 0, transaccion: 0 };
  }
}, 30000);
flush.unref();

function collection() {
  return mongoose.connection.db.collection(collectionName);
}

function record(fields) {
  const fecha = new Date();
  const ctx = context.getStore();
  const event = {
    _id: randomUUID(), fecha, vence_en: new Date(+fecha + retentionMs),
    actor_tipo: ctx?.job ? 'job' : 'desconocido', version_backend: version,
    solicitud_id: ctx?.requestId, job_id: ctx?.jobId, job: ctx?.job,
    ...fields
  };

  for (const key of ['usuario_id', 'actor_id', 'plan_id']) event[key] = asObjectId(event[key]);
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

function actor(userId, role) {
  const id = asObjectId(userId);
  if (!id) return { actor_tipo: 'desconocido' };
  const administrador = ['admin_general', 'admin_negocio', 'moderador_tienda'].includes(role);
  return { usuario_id: id, actor_id: id, actor_tipo: administrador ? 'administrador' : 'usuario' };
}

function anonymousLimit() {
  const minute = Math.floor(Date.now() / 60000);
  if (minute !== anonymousWindow) {
    anonymousWindow = minute;
    anonymousCount = 0;
  }
  return ++anonymousCount > 120;
}

const pendingEvents = new Set();

function observe(fields) {
  if (pending >= maxPending || (fields.actor_tipo === 'desconocido' && anonymousLimit())) {
    reportLoss('limite');
    return Promise.resolve();
  }
  pending++;
  const promise = Promise.resolve()
    .then(() => collection().insertOne(validateEvent(record(fields)), { timeoutMS: 750, writeConcern: { w: 'majority' } }))
    .catch(() => reportLoss('escritura'))
    .finally(() => { pending--; pendingEvents.delete(promise); });
  pendingEvents.add(promise);
  return promise;
}

function captureProgress(plan) {
  if (!plan) return undefined;
  const { dia_actual, estado, racha_dias, racha_maxima, ultima_fecha_actividad } = plan;
  return Object.fromEntries(Object.entries({
    dia_actual, estado, racha_dias, racha_maxima, version: plan.__v,
    ultima_fecha_actividad: ultima_fecha_actividad instanceof Date ? ultima_fecha_actividad : undefined
  }).filter(([, value]) => value !== undefined));
}

const progressFields = 'usuario_id dia_actual estado racha_dias racha_maxima ultima_fecha_actividad __v';

// The callback only performs database operations. The driver can retry the whole callback
// for transient errors and retry the commit itself if its outcome is unknown.
async function auditMutation(evento, before, mutate, details = {}) {
  const ctx = context.getStore();
  const base = record({ evento, resultado: 'confirmado', ...details });
  if (ctx?.counts) ctx.counts.candidatos++;
  try {
    if (operational()) {
      const durable = critical.has(evento);
      const userId = asObjectId(before?.usuario_id);
      const event = {
        ...base, ...(ctx?.job ? { usuario_id: userId } : actor(userId, ctx?.role)),
        plan_id: asObjectId(before?._id ?? before?.plan_id),
        ...(before && { anterior: captureProgress(before) })
      };
      const result = await mutate(undefined, durable ? [appendStage(event)] : []);
      if (ctx?.counts) ctx.counts[result ? 'confirmados' : 'conflictos']++;
      if (!result) return null;
      if (durable) {
        const pending = result.get('auditoria_pendiente');
        if (!pending?.some(item => item._id === event._id)) reportLoss('limite');
        else if (pending.length >= limit - 2) console.warn('auditoria_pendientes_altos');
        // El campo se seleccionó sólo para comprobar el límite. No serializarlo.
        delete result._doc.auditoria_pendiente;
      } else {
        void observe({ ...event, plan_id: result._id, usuario_id: result.usuario_id,
          ...(!ctx?.job && actor(result.usuario_id, ctx?.role)), posterior: captureProgress(result) });
      }
      return result;
    }
    const result = await mongoose.connection.getClient().withSession(session =>
      session.withTransaction(async () => {
        const after = await mutate(session);
        if (!after) return null;
        const userId = asObjectId(after.usuario_id);
        await collection().insertOne({
          ...base,
          ...(ctx?.job ? { usuario_id: userId } : actor(userId, ctx?.role)),
          plan_id: asObjectId(after._id),
          ...(before && { anterior: captureProgress(before) }),
          posterior: captureProgress(after)
        }, { session, ignoreUndefined: true });
        return after;
      }, {
        readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
        readPreference: 'primary', timeoutMS: 8000
      })
    );
    if (ctx?.counts) ctx.counts[result ? 'confirmados' : 'conflictos']++;
    return result;
  } catch (error) {
    if (ctx?.counts) ctx.counts.errores++;
    if (error.code === 11000 && error.keyPattern?.usuario_id) throw error;
    reportLoss('transaccion');
    throw new AppError(503, 'No se pudo confirmar el cambio. Actualizá la vista antes de reintentar.');
  }
}

async function auditJob(job, run) {
  const parent = context.getStore();
  const counts = { candidatos: 0, confirmados: 0, conflictos: 0, errores: 0, errores_notificacion: 0 };
  const ctx = { requestId: parent?.requestId, jobId: randomUUID(), job, counts };
  return context.run(ctx, async () => {
    await observe({ evento: 'job_inicio', resultado: 'solicitado' });
    let result = 'confirmado';
    try {
      const value = await run();
      counts.errores_notificacion += value?.fallidos ?? 0;
      if (counts.errores || counts.errores_notificacion) result = 'parcial';
      return value;
    } catch (error) {
      result = 'error';
      counts.errores++;
      throw error;
    } finally {
      await observe({ evento: 'job_fin', resultado: result, conteo: counts });
      if (parent?.counts) {
        for (const key of Object.keys(counts)) parent.counts[key] += counts[key];
      }
    }
  });
}

function trackPlan(plan) {
  const scope = context.getStore();
  if (scope && plan) {
    scope.planId = asObjectId(plan._id);
    scope.day = plan.dia_actual >= 1 && plan.dia_actual <= 30 ? plan.dia_actual : undefined;
  }
}

const waitForObservations = () => Promise.all(pendingEvents);

module.exports = { context, collection, actor, observe, auditMutation, auditJob, progressFields, waitForObservations, trackPlan };
