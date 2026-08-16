const mongoose = require('mongoose');
const { Schema } = mongoose;

const historialCorreoSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  email_destino: { type: String, required: true },
  tipo_correo: {
    type: String,
    enum: ['bienvenida', 'urgencia_activacion', 'hito', 'racha_rota', 'recuperacion_inactividad', 'recordatorio_diario', 'recuperacion_contrasena'],
    required: true
  },
  meta: { type: Schema.Types.Mixed },
  fecha_envio: { type: Date, default: Date.now, expires: 5184000 },
  estado: { type: String, enum: ['enviado', 'fallido'], required: true }
});

historialCorreoSchema.index({ usuario_id: 1, tipo_correo: 1, estado: 1 });

module.exports = mongoose.model('HistorialCorreo', historialCorreoSchema, 'historial_correos');
