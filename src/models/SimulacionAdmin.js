const mongoose = require('mongoose');

const simulacionSchema = new mongoose.Schema({
  administrador_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  dia_actual: { type: Number, required: true, min: 1, max: 30, default: 1 },
  version: { type: Number, required: true, default: 0 }
});

module.exports = mongoose.model('SimulacionAdmin', simulacionSchema, 'simulaciones_admin');
