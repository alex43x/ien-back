const mongoose = require('mongoose');
const { Schema } = mongoose;

const passwordResetTokenSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  token_hash: { type: String, required: true },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_expiracion: { type: Date, required: true },
  usado: { type: Boolean, default: false }
});

passwordResetTokenSchema.index({ fecha_expiracion: 1 }, { expireAfterSeconds: 30 * 60 });
passwordResetTokenSchema.index({ token_hash: 1 }, { unique: true });
passwordResetTokenSchema.index({ usuario_id: 1 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema, 'password_reset_tokens');
