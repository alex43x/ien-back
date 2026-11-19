const { auditMutation, auditJob, progressFields } = require('../auditoria/auditoria');
const PlanProgreso = require('../../models/PlanProgreso');
const Usuario = require('../../models/Usuario');
const { getInicioDeDiaDeAyer, getFechaHaceDias } = require('../../utils/fechas');
const { filtroPlanSinCambios } = require('../plan/reinicios.service');

const actividadValida = {
  $and: [
    { $eq: [{ $type: '$ultima_fecha_actividad' }, 'date'] },
    { $eq: [{ $type: '$fecha_inicio' }, 'date'] },
    { $gt: ['$ultima_fecha_actividad', new Date(0)] },
    { $gte: ['$ultima_fecha_actividad', '$fecha_inicio'] }
  ]
};

async function findUsuariosRezagados(horaUtcActual, minutoUtcActual) {
  const inicioHoy = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  return PlanProgreso.aggregate([
    {
      $match: {
        estado: 'activo',
        progreso_diario: { $not: { $elemMatch: { completado: true, fecha_completado: { $gte: inicioHoy } } } },
        $expr: {
          $eq: [
            { $arrayElemAt: ['$progreso_diario.completado', { $subtract: ['$dia_actual', 1] }] },
            false
          ]
        }
      }
    },
    { $lookup: { from: 'usuarios', localField: 'usuario_id', foreignField: '_id', as: 'usuario' } },
    { $unwind: '$usuario' },
    {
      $match: {
        $expr: {
          $and: [
            { $eq: [{ $ifNull: ['$usuario.hora_recordatorio_utc', 13] }, horaUtcActual] },
            { $eq: [{ $ifNull: ['$usuario.minuto_recordatorio_utc', 0] }, minutoUtcActual] }
          ]
        }
      }
    },
    {
      $project: {
        usuario_id: 1,
        dia_actual: 1,
        racha_dias: 1,
        nombre: '$usuario.nombre',
        email: '$usuario.email'
      }
    }
  ]);
}

/**
 * Resetea racha_dias a 0 para planes activos cuya ultima_fecha_actividad
 * sea anterior a ayer en calendario UTC.
 *
 * LÓGICA DE DÍA CALENDARIO (alineada con complete-day):
 *   - ultima_fecha_actividad = HOY  → NO resetear (el usuario ya completó hoy).
 *   - ultima_fecha_actividad = AYER → NO resetear (el usuario todavía tiene la
 *     ventana de hoy para completar antes de que el cron vuelva a correr).
 *   - ultima_fecha_actividad < AYER → RESETEAR.
 *
 * Criterio de "ayer en UTC": calculamos el inicio del día UTC de ayer y
 * buscamos documentos cuya fecha sea estrictamente anterior a ese timestamp.
 * Esto reemplaza la vieja resta de 24*60*60*1000 que podía resetear usuarios
 * que completaron a las 23:59 UTC del día anterior dentro de la misma ventana.
 */
async function demoledorDeRachas() {
  const ahora = new Date();
  const inicioDeDiaDeAyer = getInicioDeDiaDeAyer(ahora);
  const filtro = {
    estado: 'activo',
    ultima_fecha_actividad: { $lt: inicioDeDiaDeAyer },
    racha_dias: { $gt: 0 },
    $expr: actividadValida
  };

  const planesAfectados = await PlanProgreso
    .find(filtro)
    .select(progressFields)
    .lean();

  const usuarios_afectados = [];
  for (const plan of planesAfectados) {
    try {
      const actualizado = await auditMutation('racha_interrumpida', plan, async session => {
        const resultado = await PlanProgreso.updateOne(filtroPlanSinCambios(plan), {
          $set: { racha_dias: 0, racha_rota_en: ahora },
          $inc: { __v: 1 }
        }, { session });
        if (!resultado.modifiedCount) return null;
        return { ...plan, racha_dias: 0, __v: (plan.__v ?? 0) + 1 };
      }, {
        motivo: 'dia_sin_completar', regla: 'calendario_utc_v1',
        evaluado_en: ahora, umbral_hasta: inicioDeDiaDeAyer
      });
      if (actualizado) usuarios_afectados.push({ usuario_id: plan.usuario_id, racha_rota: plan.racha_dias });
    } catch {
      // La transacción y el resumen del job registran el fallo sin exponer el plan.
    }
  }

  return {
    matchedCount: usuarios_afectados.length,
    modifiedCount: usuarios_afectados.length,
    usuarios_afectados
  };
}

async function findUsuariosSinActivar() {
  const hace5Dias = getFechaHaceDias(5);
  return Usuario.aggregate([
    // AUD-06: solo pacientes. Admins y moderadores nunca tienen plan y antes
    // recibían el correo de "activá tu programa".
    { $match: { rol: 'usuario', fecha_registro: { $lte: hace5Dias } } },
    { $lookup: { from: 'planes_progreso', localField: '_id', foreignField: 'usuario_id', as: 'plan' } },
    { $match: { plan: { $size: 0 } } },
    { $project: { nombre: 1, email: 1, producto_id: 1, fecha_registro: 1 } }
  ]);
}

async function findUsuariosParaRecuperar() {
  const hace3Dias = getFechaHaceDias(3);
  return PlanProgreso.aggregate([
    {
      $match: {
        estado: 'activo',
        ultima_fecha_actividad: { $lte: hace3Dias },
        $expr: {
          $eq: [
            { $arrayElemAt: ['$progreso_diario.completado', { $subtract: ['$dia_actual', 1] }] },
            false
          ]
        }
      }
    },
    { $lookup: { from: 'usuarios', localField: 'usuario_id', foreignField: '_id', as: 'usuario' } },
    { $unwind: '$usuario' },
    { $project: { usuario_id: 1, dia_actual: 1, nombre: '$usuario.nombre', email: '$usuario.email' } }
  ]);
}

/**
 * Planes activos sin actividad por 30+ días → candidatos a abandono.
 * Proyecta plan_id (id del plan), usuario_id (id real del usuario) y datos
 * del usuario para el correo de notificación.
 */
async function findPlanesParaAbandonar(ahora = new Date(Date.now())) {
  const hace30Dias = new Date(+ahora - 30 * 86400000);
  return PlanProgreso.aggregate([
    { $match: { estado: 'activo', ultima_fecha_actividad: { $lte: hace30Dias }, $expr: actividadValida } },
    { $lookup: { from: 'usuarios', localField: 'usuario_id', foreignField: '_id', as: 'usuario' } },
    { $unwind: '$usuario' },
    {
      $project: {
        _id: 0,
        plan_id: '$_id',
        estado: 1,
        ultima_fecha_actividad: 1,
        __v: 1,
        usuario_id: 1,
        dia_actual: 1,
        racha_dias: 1,
        racha_maxima: 1,
        nombre: '$usuario.nombre',
        email: '$usuario.email'
      }
    }
  ]);
}

/**
 * Planes activos con 21 a menos de 30 días de inactividad que avanzaron más
 * allá del día 1. A partir de 30 días corresponde abandono.
 */
async function findPlanesParaReiniciar(ahora = new Date()) {
  const diaMs = 86400000;
  const hace21Dias = new Date(ahora.getTime() - 21 * diaMs);
  const hace30Dias = new Date(ahora.getTime() - 30 * diaMs);
  return PlanProgreso.aggregate([
    {
      $match: {
        estado: 'activo',
        ultima_fecha_actividad: { $gt: hace30Dias, $lte: hace21Dias },
        dia_actual: { $gt: 1 },
        $expr: actividadValida
      }
    },
    { $lookup: { from: 'usuarios', localField: 'usuario_id', foreignField: '_id', as: 'usuario' } },
    { $unwind: '$usuario' },
    {
      $project: {
        _id: 0,
        plan_id: '$_id',
        estado: 1,
        ultima_fecha_actividad: 1,
        __v: 1,
        usuario_id: 1,
        dia_actual: 1,
        racha_dias: 1,
        racha_maxima: 1,
        nombre: '$usuario.nombre',
        email: '$usuario.email'
      }
    }
  ]);
}

module.exports = {
  findUsuariosRezagados,
  demoledorDeRachas: () => auditJob('racha', demoledorDeRachas),
  findUsuariosSinActivar,
  findUsuariosParaRecuperar,
  findPlanesParaAbandonar,
  findPlanesParaReiniciar
};
