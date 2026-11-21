const { randomUUID } = require('node:crypto');
const { auditMutation } = require('../auditoria/auditoria');
const PlanProgreso = require('../../models/PlanProgreso');

function filtroPlanSinCambios(plan) {
  return {
    _id: plan.plan_id ?? plan._id,
    estado: plan.estado,
    dia_actual: plan.dia_actual,
    ultima_fecha_actividad: plan.ultima_fecha_actividad,
    __v: plan.__v ?? null
  };
}

function archivarYReiniciar(plan, motivo, ahora, cambios = {}, umbrales = {}) {
  const progresoVacio = Array.from({ length: 30 }, (_, i) => ({
    dia_numero: i + 1,
    completado: false,
    fecha_completado: null,
    respuesta_usuario: null
  }));

  // En una misma etapa, todas las expresiones leen el documento anterior.
  const referencia = randomUUID();
  const esReactivacion = motivo === 'reactivacion';
  const evento = esReactivacion ? 'plan_reactivado' : 'plan_reiniciado';
  return auditMutation(evento, plan, (session, stages = []) => PlanProgreso.findOneAndUpdate(filtroPlanSinCambios(plan), [{
    $set: {
      historial_reinicios: {
        $concatArrays: [{ $ifNull: ['$historial_reinicios', []] }, [{
          fecha: ahora,
          referencia_auditoria: referencia,
          motivo,
          estado: '$estado',
          fecha_inicio: '$fecha_inicio',
          ultima_fecha_actividad: '$ultima_fecha_actividad',
          dia_actual: '$dia_actual',
          racha_dias: '$racha_dias',
          racha_maxima: '$racha_maxima',
          racha_rota_en: '$racha_rota_en',
          hitos_alcanzados: '$hitos_alcanzados',
          progreso_diario: '$progreso_diario'
        }]]
      },
      dia_actual: 1,
      racha_dias: 0,
      progreso_diario: { $literal: progresoVacio },
      __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] },
      ...cambios
    }
  }, ...stages], { new: true, session, ...(stages.length && { projection: { '+auditoria_pendiente': 1 } }) }), {
    motivo,
    evaluado_en: ahora,
    regla: esReactivacion ? 'reactivacion_v1' : 'inactividad_21d_v1',
    referencia_historial: referencia,
    ...umbrales
  });
}

module.exports = { filtroPlanSinCambios, archivarYReiniciar };
