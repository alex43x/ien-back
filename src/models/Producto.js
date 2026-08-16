const mongoose = require('mongoose');
const { Schema } = mongoose;

const productoSchema = new Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  tienda_id: { type: Schema.Types.ObjectId, ref: 'Tienda', required: true }
});

productoSchema.index({ tienda_id: 1 });

module.exports = mongoose.model('Producto', productoSchema, 'productos');
