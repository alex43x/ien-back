const mongoose = require('mongoose');
const Plan = require('../../models/PlanProgreso');
const AppError = require('../../utils/AppError');
const DIA = 86400000;

// El mismo instante se usa en todos los límites. No cambia la regla UTC existente.
function decidir(plan, ahora = new Date()) {
  if (plan.estado !== 'activo') return null;
  const actividad = new Date(plan.ultima_fecha_actividad);
  if (!plan.ultima_fecha_actividad || !Number.isFinite(+actividad)) return null;
  // Las fechas corruptas se investigan; no se convierten en pérdida de progreso.
  if (actividad < new Date(plan.fecha_inicio) || actividad > ahora) return null;
  if (+actividad <= +ahora - 30 * DIA) return 'plan_abandonado';
  if (+actividad <= +ahora - 7 * DIA && plan.dia_actual > 1) return 'plan_reiniciado';
  const ayer = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - 1));
  if (plan.racha_dias > 0 && actividad < ayer) return 'racha_rota';
  return null;
}

function versionFiltro(plan) {
  return { _id: plan._id, estado: plan.estado, dia_actual: plan.dia_actual,
    ultima_fecha_actividad: plan.ultima_fecha_actividad,
    $expr: { $eq: [{ $ifNull: ['$__v', 0] }, plan.__v || 0] } };
}

// El ID del sucesor queda reservado dentro del cierre atómico. Un fallo de proceso
// se recupera repitiendo este upsert; nunca se vacía el intento de origen.
async function asegurarSucesor(plan) {
  if (!plan.sucesor_id) return null;
  try {
    return await Plan.findOneAndUpdate({ _id: plan.sucesor_id }, { $setOnInsert: {
      usuario_id: plan.usuario_id, tienda_id: plan.tienda_id, codigo_utilizado: plan.codigo_utilizado,
      numero_intento: (plan.numero_intento || 1) + 1, intento_anterior_id: plan._id,
      evento_origen_id: (plan.eventos || []).find(e => ['plan_reiniciado', 'plan_abandonado', 'continuacion_solicitada'].includes(e.tipo))?._id,
      estado: 'pendiente', fecha_inicio: plan.fecha_cierre,
      ultima_fecha_actividad: null, test_inicial: plan.test_inicial,
      test_inicial_origen_id: plan.test_inicial_origen_id || plan._id
    } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return Plan.findById(plan.sucesor_id);
  }
}

async function evaluar({ ahora = new Date(), tipo } = {}) {
  const corrida = require('crypto').randomUUID();
  const resultado = { evaluados: 0, aplicados: [], conflictos: 0, anomalias: 0 };
  if (process.env.PLAN_TRANSITIONS_ENABLED === 'false') return { ...resultado, pausado: true };
  const cursor = Plan.find({ estado: 'activo' }).lean().cursor();
  for await (const plan of cursor) {
    resultado.evaluados++;
    if (!plan.ultima_fecha_actividad || new Date(plan.ultima_fecha_actividad) < new Date(plan.fecha_inicio) || new Date(plan.ultima_fecha_actividad) > ahora) {
      resultado.anomalias++; continue;
    }
    const decision = decidir(plan, ahora);
    if (!decision || (tipo && tipo !== decision)) continue;
    const evento = { _id: new mongoose.Types.ObjectId(), tipo: decision, fecha: ahora,
      motivo: 'inactividad', envio: 'pendiente', intentos: 0,
      meta: { corrida, origen: 'mantenimiento', version_origen: plan.__v || 0, estado_anterior: plan.estado,
        dia_actual: plan.dia_actual, racha_rota: plan.racha_dias, ultima_fecha_actividad: plan.ultima_fecha_actividad,
        limite_racha: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - 1)),
        limite_reinicio: new Date(+ahora - 7 * DIA), limite_abandono: new Date(+ahora - 30 * DIA) } };
    const cambio = decision === 'racha_rota'
      ? { racha_dias: 0, racha_rota_en: ahora }
      : { estado: decision === 'plan_abandonado' ? 'abandonado' : 'reiniciado',
          fecha_cierre: ahora, motivo_cierre: 'inactividad', sucesor_id: new mongoose.Types.ObjectId() };
    const aplicado = await Plan.findOneAndUpdate(versionFiltro(plan), {
      $set: cambio, $inc: { __v: 1 }, $push: { eventos: evento }
    }, { new: true });
    if (!aplicado) { resultado.conflictos++; continue; }
    await asegurarSucesor(aplicado);
    resultado.aplicados.push({ plan_id: plan._id, usuario_id: plan.usuario_id, tipo: decision, evento_id: evento._id, racha_rota: plan.racha_dias });
  }
  // Reconciliación de cierres que quedaron a mitad de camino por un fallo.
  for await (const cerrado of Plan.find({ sucesor_id: { $exists: true } }).cursor()) await asegurarSucesor(cerrado);
  return resultado;
}

async function activar(usuarioId, planId) {
  if (!mongoose.isValidObjectId(planId)) throw new AppError(400, 'Intento inválido');
  const candidato = await Plan.findOne({ _id: planId, usuario_id: usuarioId }).select('tienda_id');
  if (!candidato) throw new AppError(404, 'Intento no encontrado');
  const tienda = await require('../../models/Tienda').findById(candidato.tienda_id).select('activo').lean();
  if (!tienda || tienda.activo === false) throw new AppError(403, 'La tienda asociada ya no está activa');
  const ahora = new Date();
  try {
    const plan = await Plan.findOneAndUpdate({ _id: planId, usuario_id: usuarioId, estado: 'pendiente' }, {
      $set: { estado: 'activo', fecha_inicio: ahora, ultima_fecha_actividad: ahora }, $inc: { __v: 1 },
      $push: { eventos: { tipo: 'activado', fecha: ahora, envio: 'omitido' } }
    }, { new: true });
    if (plan) return plan;
    const existente = await Plan.findOne({ _id: planId, usuario_id: usuarioId, estado: 'activo' });
    if (existente) return existente;
    throw new AppError(409, 'Este intento no se puede activar');
  } catch (err) { if (err.code === 11000) throw new AppError(409, 'Ya existe un intento activo'); throw err; }
}

async function continuar(usuarioId) {
  let plan = await Plan.findOne({ usuario_id: usuarioId }).sort({ fecha_inicio: -1, _id: -1 });
  if (!plan) throw new AppError(404, 'No hay un intento anterior');
  if (plan.estado === 'activo') return plan;
  if (plan.estado === 'pendiente') return activar(usuarioId, plan._id);
  if (!['abandonado', 'reiniciado'].includes(plan.estado)) throw new AppError(409, 'El programa ya está completado');
  if (!plan.sucesor_id) {
    const reservado = await Plan.findOneAndUpdate({ _id: plan._id, sucesor_id: { $exists: false } }, {
      $set: { sucesor_id: new mongoose.Types.ObjectId() }, $inc: { __v: 1 },
      $push: { eventos: { tipo: 'continuacion_solicitada', fecha: new Date(), envio: 'omitido' } }
    }, { new: true });
    plan = reservado || await Plan.findById(plan._id);
  }
  const nuevo = await asegurarSucesor(plan);
  return activar(usuarioId, nuevo._id);
}
module.exports = { decidir, versionFiltro, asegurarSucesor, evaluar, activar, continuar };
