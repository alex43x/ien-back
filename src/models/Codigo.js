const mongoose = require('mongoose');
const { Schema } = mongoose;

const codigoSchema = new Schema({
  codigo: { type: String, required: true, unique: true },
  producto_id: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  tienda_id: { type: Schema.Types.ObjectId, ref: 'Tienda', required: true },
  activo: { type: Boolean, default: false },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_activacion: { type: Date, default: null }
});

codigoSchema.index({ tienda_id: 1 });

module.exports = mongoose.model('Codigo', codigoSchema, 'codigos');
