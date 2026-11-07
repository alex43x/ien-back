const mongoose = require('mongoose');
const { Schema } = mongoose;

const grupoSchema = new Schema({
  nombre: { type: String, required: true },
  fecha_creacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Grupo', grupoSchema, 'grupos');
