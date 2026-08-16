const mongoose = require('mongoose');
const { Schema } = mongoose;

// Nuevo schema de test inicial: almacena respuestas con su competencia mapeada,
// las puntuaciones por competencia (suma de scores, rango 5-25) y las competencias
// cuya suma fue < 20 (áreas de mejora), expresadas como labels.
const testInicialSchema = new Schema({
  fecha_completado: Date,
  respuestas: [{
    pregunta_numero: Number,
    competencia: String,
    score: Number
  }],
  puntuaciones_por_competencia: [{
    competencia: String,
    competencia_label: String,
    puntuacion: Number
  }],
  competencias_a_mejorar: [String]  // competencia_label de las que dieron < 20
}, { _id: false });

const diaProgresoSchema = new Schema({
  dia_numero: { type: Number, required: true },
  completado: { type: Boolean, default: false },
  fecha_completado: { type: Date, default: null },
  // Respuesta libre del usuario al ejercicio del día. Sin validación de forma
  // interna — varía por tipo de ejercicio (reflexion, registro, practica).
  respuesta_usuario: { type: Schema.Types.Mixed, default: null }
}, { _id: false });

const planProgresoSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  tienda_id: { type: Schema.Types.ObjectId, ref: 'Tienda', required: true },
  codigo_utilizado: { type: String, required: true },
  fecha_inicio: { type: Date, default: Date.now },
  dia_actual: { type: Number, default: 1 },
  racha_dias: { type: Number, default: 0 },
  racha_maxima: { type: Number, default: 0 },
  racha_rota_en: { type: Date, default: null },
  hitos_alcanzados: { type: [Number], default: [] },
  ultima_fecha_actividad: { type: Date, default: Date.now },
  estado: { type: String, enum: ['activo', 'completado', 'abandonado'], default: 'activo' },
  test_inicial: testInicialSchema,
  progreso_diario: {
    type: [diaProgresoSchema],
    default: () => Array.from({ length: 30 }, (_, i) => ({
      dia_numero: i + 1,
      completado: false,
      fecha_completado: null,
      respuesta_usuario: null
    }))
  }
});

planProgresoSchema.index({ estado: 1, dia_actual: 1 });
planProgresoSchema.index({ estado: 1, ultima_fecha_actividad: 1 });
planProgresoSchema.index({ usuario_id: 1, estado: 1 });
planProgresoSchema.index({ tienda_id: 1, estado: 1 });
planProgresoSchema.index(
  { usuario_id: 1 },
  { unique: true, partialFilterExpression: { estado: 'activo' } }
);

planProgresoSchema.index({ racha_rota_en: 1 });

module.exports = mongoose.model('PlanProgreso', planProgresoSchema, 'planes_progreso');
