const mongoose = require('mongoose');
const { Schema } = mongoose;

const productoSchema = new Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  grupo_id: { type: Schema.Types.ObjectId, ref: 'Grupo', required: true }
});

productoSchema.index({ grupo_id: 1 });

module.exports = mongoose.model('Producto', productoSchema, 'productos');
