const mongoose = require('mongoose');
const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  token_hash: { type: String, required: true },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_expiracion: { type: Date, required: true },
  revocado: { type: Boolean, default: false }
});

refreshTokenSchema.index({ fecha_expiracion: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ token_hash: 1 });
refreshTokenSchema.index({ usuario_id: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema, 'refresh_tokens');
