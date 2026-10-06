const mongoose = require('mongoose');
const { Schema } = mongoose;

const tiendaSchema = new Schema({
  nombre_tienda: { type: String, required: true },
  ciudad: { type: String, required: true },
  grupo_id: { type: Schema.Types.ObjectId, ref: 'Grupo', required: true },
  activo: { type: Boolean, default: true },
  fecha_creacion: { type: Date, default: Date.now }
});

tiendaSchema.index({ activo: 1 });
tiendaSchema.index({ grupo_id: 1 });

module.exports = mongoose.model('Tienda', tiendaSchema, 'tiendas');
