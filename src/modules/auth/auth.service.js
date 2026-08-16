const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Usuario = require('../../models/Usuario');
const Tienda = require('../../models/Tienda');
const Codigo = require('../../models/Codigo');
const RefreshToken = require('../../models/RefreshToken');
const PasswordResetToken = require('../../models/PasswordResetToken');
const Producto = require('../../models/Producto');
const AppError = require('../../utils/AppError');
const { enviarCorreo } = require('../email/email.service');
const { bienvenida, recuperacionContrasena } = require('../email/templates');

const JWT_SECRET = process.env.JWT_SECRET;

function generarAccessToken(usuario) {
  return jwt.sign({ id: usuario._id }, JWT_SECRET, { expiresIn: '15m' });
}

async function generarRefreshToken(usuarioId) {
  const token = crypto.randomBytes(40).toString('hex');
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const fecha_expiracion = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ usuario_id: usuarioId, token_hash, fecha_expiracion });
  return token;
}

exports.validateCode = async (codigo_activacion) => {
  if (typeof codigo_activacion !== 'string') {
    throw new AppError(400, 'Código de activación inválido');
  }

  const codDoc = await Codigo.findOne({ codigo: codigo_activacion, activo: true })
    .populate('tienda_id')
    .populate('producto_id');

  if (!codDoc) {
    throw new AppError(404, 'Código inválido');
  }
  if (codDoc.tienda_id && codDoc.tienda_id.activo === false) {
    throw new AppError(403, 'La tienda asociada a este código ya no está activa');
  }

  return {
    tienda: codDoc.tienda_id,
    producto: codDoc.producto_id
  };
};

exports.register = async ({ nombre, email, password, codigo_activacion, hora_recordatorio, minuto_recordatorio }) => {
  if (typeof email !== 'string' || typeof password !== 'string' || typeof codigo_activacion !== 'string') {
    throw new AppError(400, 'Todos los campos son requeridos');
  }

  const codDoc = await Codigo.findOne({ codigo: codigo_activacion, activo: true });
  if (!codDoc) {
    throw new AppError(404, 'Código de activación inválido');
  }

  const tiendaDoc = await Tienda.findById(codDoc.tienda_id).select('activo nombre_tienda').lean();
  if (!tiendaDoc || tiendaDoc.activo === false) {
    throw new AppError(403, 'La tienda asociada a este código ya no está activa');
  }

  const existe = await Usuario.findOne({ email });
  if (existe) {
    throw new AppError(409, 'El email ya está registrado');
  }

  let hora_recordatorio_utc = undefined;
  let minuto_recordatorio_utc = undefined;
  if (hora_recordatorio !== undefined) {
    if (typeof hora_recordatorio !== 'number' || !Number.isInteger(hora_recordatorio) || hora_recordatorio < 0 || hora_recordatorio > 23) {
      throw new AppError(400, 'La hora de recordatorio debe ser un número entero entre 0 y 23 (hora PY)');
    }
    hora_recordatorio_utc = (hora_recordatorio + 3) % 24;
  }
  if (minuto_recordatorio !== undefined) {
    if (minuto_recordatorio !== 0 && minuto_recordatorio !== 30) {
      throw new AppError(400, 'El minuto de recordatorio debe ser 0 o 30');
    }
    minuto_recordatorio_utc = minuto_recordatorio;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({
    nombre,
    email,
    password_hash,
    tienda_id: codDoc.tienda_id,
    producto_id: codDoc.producto_id,
    codigo_activacion,
    ...(hora_recordatorio_utc !== undefined && { hora_recordatorio_utc }),
    ...(minuto_recordatorio_utc !== undefined && { minuto_recordatorio_utc })
  });

  const access_token = generarAccessToken(usuario);
  const refresh_token = await generarRefreshToken(usuario._id);

  Producto.findById(codDoc.producto_id).select('nombre').lean()
    .then(() => {
      const { asunto, html } = bienvenida(usuario.nombre, tiendaDoc.nombre_tienda);
      return enviarCorreo({
        usuario_id: usuario._id,
        destinatario: usuario.email,
        asunto,
        html,
        tipo_correo: 'bienvenida'
      });
    })
    .catch(err => console.error('[register] Error en correo de bienvenida:', err.message));

  return { access_token, refresh_token, usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, tiendas_administradas: usuario.tiendas_administradas || [] } };
};

exports.login = async ({ email, password }) => {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AppError(400, 'Email y contraseña requeridos');
  }

  const usuario = await Usuario.findOne({ email }).lean();
  if (!usuario) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const access_token = generarAccessToken(usuario);
  const refresh_token = await generarRefreshToken(usuario._id);
  return { access_token, refresh_token, usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, tiendas_administradas: usuario.tiendas_administradas || [] } };
};

exports.refreshToken = async (refreshTokenPlano) => {
  if (typeof refreshTokenPlano !== 'string') {
    throw new AppError(400, 'Refresh token requerido');
  }

  const token_hash = crypto.createHash('sha256').update(refreshTokenPlano).digest('hex');
  const doc = await RefreshToken.findOne({ token_hash, revocado: false, fecha_expiracion: { $gt: new Date() } });
  if (!doc) {
    throw new AppError(401, 'Refresh token inválido o expirado');
  }

  doc.revocado = true;
  await doc.save();

  const access_token = generarAccessToken({ _id: doc.usuario_id });
  const refresh_token = await generarRefreshToken(doc.usuario_id);
  return { access_token, refresh_token };
};

exports.logout = async (refreshTokenPlano) => {
  if (typeof refreshTokenPlano !== 'string') {
    throw new AppError(400, 'Refresh token requerido');
  }

  const token_hash = crypto.createHash('sha256').update(refreshTokenPlano).digest('hex');
  const doc = await RefreshToken.findOne({ token_hash, revocado: false });
  if (doc) {
    doc.revocado = true;
    await doc.save();
  }

  return { mensaje: 'Sesión cerrada' };
};

exports.forgotPassword = async (email) => {
  if (typeof email !== 'string') {
    throw new AppError(400, 'Email requerido');
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  const usuario = await Usuario.findOne({ email });

  if (usuario) {
    const token = crypto.randomBytes(32).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const fecha_expiracion = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetToken.create({
      usuario_id: usuario._id,
      token_hash,
      fecha_expiracion
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    const { asunto, html } = recuperacionContrasena(usuario.nombre, resetUrl);

    enviarCorreo({
      usuario_id: usuario._id,
      destinatario: usuario.email,
      asunto,
      html,
      tipo_correo: 'recuperacion_contrasena'
    }).catch(err => console.error('[forgotPassword] Error en correo de recuperación:', err.message));
  }
};

exports.verifyResetToken = async (token) => {
  if (typeof token !== 'string') {
    throw new AppError(400, 'Token requerido');
  }

  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const doc = await PasswordResetToken.findOne({
    token_hash,
    usado: false,
    fecha_expiracion: { $gt: new Date() }
  }).populate('usuario_id', 'email');

  if (!doc || !doc.usuario_id) {
    return { valido: false };
  }

  const email = doc.usuario_id.email;
  const masked = email.charAt(0) + '***' + email.slice(email.indexOf('@'));

  return { valido: true, email: masked };
};

exports.resetPassword = async (token, nuevaPassword) => {
  if (typeof token !== 'string' || typeof nuevaPassword !== 'string') {
    throw new AppError(400, 'Token y nueva contraseña requeridos');
  }

  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const doc = await PasswordResetToken.findOneAndUpdate(
    { token_hash, usado: false, fecha_expiracion: { $gt: new Date() } },
    { usado: true },
    { new: false }
  );

  if (!doc) {
    throw new AppError(400, 'Token inválido o expirado');
  }

  const usuario = await Usuario.findById(doc.usuario_id);
  if (!usuario) {
    throw new AppError(404, 'Usuario no encontrado');
  }

  usuario.password_hash = await bcrypt.hash(nuevaPassword, 10);
  await usuario.save();

  await RefreshToken.updateMany(
    { usuario_id: usuario._id, revocado: false },
    { revocado: true }
  );

  return { mensaje: 'Contraseña actualizada' };
};

exports.changePassword = async (userId, currentPassword, nuevaPassword) => {
  if (typeof currentPassword !== 'string' || typeof nuevaPassword !== 'string') {
    throw new AppError(400, 'Contraseña actual y nueva contraseña requeridas');
  }

  const usuario = await Usuario.findById(userId);
  if (!usuario) {
    throw new AppError(404, 'Usuario no encontrado');
  }

  const coincide = await bcrypt.compare(currentPassword, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'La contraseña actual es incorrecta');
  }

  usuario.password_hash = await bcrypt.hash(nuevaPassword, 12);
  await usuario.save();

  await RefreshToken.updateMany(
    { usuario_id: usuario._id, revocado: false },
    { revocado: true }
  );

  return { mensaje: 'Contraseña actualizada. Todas las sesiones anteriores fueron cerradas.' };
};
