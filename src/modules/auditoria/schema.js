const { mongo } = require('mongoose');

const collectionName = 'eventos_auditoria';
const retentionMs = 180 * 86400000;
const eventTypes = [
  'registro_cuenta', 'horario_recordatorio', 'bienvenida_consultada', 'preguntas_consultadas',
  'resultado_test_consultado', 'envio_test_inicial', 'avance_manual_solicitado', 'retroceso_manual_solicitado', 'autocompletar_test_solicitado',
  'guardado_recibido',
  'login', 'renovacion', 'logout', 'perfil_auth', 'perfil_programa', 'actividad_consultada',
  'lista_consultada', 'guardado_rechazado', 'solicitud_plan_rechazada', 'plan_creado',
  'actividad_completada', 'racha_interrumpida', 'plan_reiniciado', 'plan_abandonado',
  'plan_reactivado', 'job_inicio', 'job_fin'
];
const results = ['confirmado', 'rechazado', 'error', 'solicitado', 'sin_cambios', 'parcial'];
const reasons = [
  'completado_hoy', 'plan_cambio', 'control_deshabilitado',
  'sesion_rechazada', 'credenciales_rechazadas', 'entrada_invalida', 'conflicto',
  'no_encontrado', 'limite', 'fallo_interno', 'inactividad', 'reactivacion',
  'dia_sin_completar', 'continuidad', 'racha_nueva', 'plan_inicial'
];
const jobs = ['racha', 'abandono', 'reinicio', 'recordatorios', 'activacion', 'recuperacion', 'diario'];
const objectId = { bsonType: 'objectId' };
const date = { bsonType: 'date' };
const number = { bsonType: 'int', minimum: 0 };
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const uuid = { bsonType: 'string', pattern: uuidPattern.source };
const day = { ...number, minimum: 1, maximum: 30 };
const state = {
  bsonType: 'object', additionalProperties: false,
  properties: {
    dia_actual: { ...day, maximum: 31 }, racha_dias: number, racha_maxima: number,
    estado: { enum: ['activo', 'completado', 'abandonado'] }, ultima_fecha_actividad: date,
    version: number
  }
};
const validator = {
  $jsonSchema: {
    bsonType: 'object',
    additionalProperties: false,
    required: ['_id', 'fecha', 'vence_en', 'evento', 'resultado', 'actor_tipo', 'version_backend'],
    properties: {
      _id: uuid, fecha: date, vence_en: date,
      evento: { enum: eventTypes }, resultado: { enum: results }, motivo: { enum: reasons },
      actor_tipo: { enum: ['usuario', 'administrador', 'job', 'desconocido'] },
      usuario_id: objectId, actor_id: objectId, plan_id: objectId,
      referencia_historial: uuid, solicitud_id: uuid, job_id: uuid, job: { enum: jobs },
      version_backend: { bsonType: 'string', pattern: '^[a-zA-Z0-9._-]{1,64}$' },
      regla: { enum: ['calendario_utc_v1', 'inactividad_21d_v1', 'abandono_30d_v1', 'reactivacion_v1'] },
      evaluado_en: date, umbral_hasta: date, umbral_desde: date,
      perfil_consultado: state, completado_hoy: { bsonType: 'bool' }, anterior: state, posterior: state, dia_programa: day,
      dias: { bsonType: 'array', maxItems: 30, items: day },
      solo_completados: { bsonType: 'bool' }, actividad_disponible: { bsonType: 'bool' },
      estado_http: { ...number, minimum: 100, maximum: 599 },
      conteo: {
        bsonType: 'object', additionalProperties: false,
        properties: { candidatos: number, confirmados: number, conflictos: number, errores: number, errores_notificacion: number }
      }
    }
  }
};
const indexes = [
  { key: { vence_en: 1 }, name: 'vence_auditoria', expireAfterSeconds: 0 },
  { key: { usuario_id: 1, fecha: 1, _id: 1 }, name: 'usuario_fecha' },
  { key: { plan_id: 1, fecha: 1 }, name: 'plan_fecha' },
  { key: { solicitud_id: 1, fecha: 1, _id: 1 }, name: 'solicitud' },
  { key: { job_id: 1, fecha: 1, _id: 1 }, name: 'ejecucion_job' }
];

function asObjectId(value) {
  if (value instanceof mongo.ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new mongo.ObjectId(value);
  return undefined;
}

// MongoDB no admite validadores de colección en admin. Usar el mismo esquema
// para comprobar los eventos que escribe el backend en esa base.
function matches(value, rule) {
  if (rule.enum) return rule.enum.includes(value);
  switch (rule.bsonType) {
    case 'object':
      return value != null && typeof value === 'object' && !Array.isArray(value)
        && (rule.required || []).every(key => Object.hasOwn(value, key))
        && Object.keys(value).every(key => Object.hasOwn(rule.properties, key) && matches(value[key], rule.properties[key]));
    case 'array': return Array.isArray(value) && value.length <= rule.maxItems && value.every(item => matches(item, rule.items));
    case 'date': return value instanceof Date && Number.isFinite(+value);
    case 'objectId': return value instanceof mongo.ObjectId;
    case 'int': return Number.isInteger(value) && value >= rule.minimum && value <= (rule.maximum ?? 2147483647);
    case 'bool': return typeof value === 'boolean';
    case 'string': return typeof value === 'string' && new RegExp(rule.pattern).test(value);
    default: return false;
  }
}

function validateEvent(event) {
  if (!matches(event, validator.$jsonSchema)) throw new Error('Evento de auditoría inválido');
  return event;
}

module.exports = { validateEvent, collectionName, retentionMs, eventTypes, validator, indexes, asObjectId, uuidPattern };
