const mongoose = require('mongoose');
const { Schema } = mongoose;

const usuarioSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  rol: { type: String, enum: ['usuario', 'moderador_tienda', 'admin_negocio', 'admin_general'], default: 'usuario' },
  tienda_id: { type: Schema.Types.ObjectId, ref: 'Tienda' },
  producto_id: { type: Schema.Types.ObjectId, ref: 'Producto' },
  tiendas_administradas: [{ type: Schema.Types.ObjectId, ref: 'Tienda', default: [] }],
  tienda_moderada: { type: Schema.Types.ObjectId, ref: 'Tienda', default: null },
  codigo_activacion: { type: String },
  fecha_registro: { type: Date, default: Date.now },
  hora_recordatorio_utc: { type: Number, min: 0, max: 23, default: 13 },
  minuto_recordatorio_utc: { type: Number, enum: [0, 30], default: 0 }
});

usuarioSchema.index({ rol: 1 });
usuarioSchema.index({ tienda_id: 1 });
usuarioSchema.index({ fecha_registro: 1 });
usuarioSchema.index({ tienda_moderada: 1 });
usuarioSchema.index({ tienda_id: 1, rol: 1 });

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
