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
const { isValidEmail, isValidPasswordLength } = require('../../utils/validators');
const { enviarCorreo } = require('../email/email.service');
const { bienvenida, recuperacionContrasena } = require('../email/templates');

const JWT_SECRET = process.env.JWT_SECRET;

// SEG-05: hash dummy precomputado (costo 10, igual que los reales) para que el
// login con email inexistente ejecute el mismo trabajo bcrypt que el login con
// email existente y no revele por timing si la cuenta existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-not-used-ien', 10);

// Paraguay opera en UTC-3 (DST permanente desde 2024). La hora que elige el
// usuario es hora local PY; para guardarla/compararla con el cron la pasamos a UTC.
const PY_UTC_OFFSET = 3;

function validarHoraRecordatorio(hora) {
  if (typeof hora !== 'number' || !Number.isInteger(hora) || hora < 0 || hora > 23) {
    throw new AppError(400, 'La hora de recordatorio debe ser un número entero entre 0 y 23 (hora PY)');
  }
}

function validarMinutoRecordatorio(minuto) {
  if (minuto !== 0 && minuto !== 30) {
    throw new AppError(400, 'El minuto de recordatorio debe ser 0 o 30');
  }
}

function horaPYaUTC(hora) {
  return (hora + PY_UTC_OFFSET) % 24;
}

function horaUTCaPY(utc) {
  return (utc - PY_UTC_OFFSET + 24) % 24;
}

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
  if (!nombre || !email || !password || !codigo_activacion || typeof email !== 'string' || typeof password !== 'string' || typeof codigo_activacion !== 'string') {
    throw new AppError(400, 'Todos los campos son requeridos');
  }

  if (!isValidEmail(email)) {
    throw new AppError(400, 'Email inválido');
  }

  if (!isValidPasswordLength(password, 8)) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres');
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
    validarHoraRecordatorio(hora_recordatorio);
    hora_recordatorio_utc = horaPYaUTC(hora_recordatorio);
  }
  if (minuto_recordatorio !== undefined) {
    validarMinutoRecordatorio(minuto_recordatorio);
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

  return { access_token, refresh_token, usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, grupo_id: usuario.grupo_id ?? null } };
};

exports.updateReminderSchedule = async (usuarioId, hora_recordatorio, minuto_recordatorio) => {
  if (hora_recordatorio === undefined || minuto_recordatorio === undefined) {
    throw new AppError(400, 'La hora y el minuto de recordatorio son requeridos');
  }

  validarHoraRecordatorio(hora_recordatorio);
  validarMinutoRecordatorio(minuto_recordatorio);

  const usuario = await Usuario.findByIdAndUpdate(
    usuarioId,
    {
      $set: {
        hora_recordatorio_utc: horaPYaUTC(hora_recordatorio),
        minuto_recordatorio_utc: minuto_recordatorio
      }
    },
    { new: true }
  ).lean();

  if (!usuario) {
    throw new AppError(404, 'Usuario no encontrado');
  }

  return { hora_recordatorio, minuto_recordatorio };
};

exports.getReminderSchedulePY = (usuario) => ({
  hora_recordatorio: horaUTCaPY(usuario.hora_recordatorio_utc ?? 13),
  minuto_recordatorio: usuario.minuto_recordatorio_utc ?? 0
});

exports.login = async ({ email, password }) => {
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    throw new AppError(400, 'Email y contraseña requeridos');
  }

  if (!isValidEmail(email)) {
    throw new AppError(400, 'Email inválido');
  }

  const usuario = await Usuario.findOne({ email }).lean();
  if (!usuario) {
    // SEG-05: costo constante — mismo trabajo bcrypt que la rama existente.
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError(401, 'Credenciales inválidas');
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const access_token = generarAccessToken(usuario);
  const refresh_token = await generarRefreshToken(usuario._id);
  return { access_token, refresh_token, usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, grupo_id: usuario.grupo_id ?? null } };
};

exports.refreshToken = async (refreshTokenPlano) => {
  if (typeof refreshTokenPlano !== 'string') {
    throw new AppError(400, 'Refresh token requerido');
  }

  const token_hash = crypto.createHash('sha256').update(refreshTokenPlano).digest('hex');
  // SEG-04: consumo atómico — solo una redención concurrente puede ganar el
  // findOneAndUpdate condicional; el resto ve revocado:true y recibe 401.
  const doc = await RefreshToken.findOneAndUpdate(
    { token_hash, revocado: false, fecha_expiracion: { $gt: new Date() } },
    { $set: { revocado: true } },
    { new: false }
  );
  if (!doc) {
    throw new AppError(401, 'Refresh token inválido o expirado');
  }

  const access_token = generarAccessToken({ _id: doc.usuario_id });
  const refresh_token = await generarRefreshToken(doc.usuario_id);
  return { access_token, refresh_token };
};

exports.logout = async (refreshTokenPlano) => {
  if (typeof refreshTokenPlano !== 'string') {
    throw new AppError(400, 'Refresh token requerido');
  }

  const token_hash = crypto.createHash('sha256').update(refreshTokenPlano).digest('hex');
  // SEG-04: revocación atómica (mismo patrón que refreshToken).
  await RefreshToken.findOneAndUpdate(
    { token_hash, revocado: false },
    { $set: { revocado: true } },
    { new: false }
  );

  return { mensaje: 'Sesión cerrada' };
};

exports.forgotPassword = async (email) => {
  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'Email requerido');
  }

  if (!isValidEmail(email)) {
    throw new AppError(400, 'Email inválido');
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  const usuario = await Usuario.findOne({ email });

  if (usuario) {
    // SEG-06: presupuesto por destinatario (compartido entre réplicas porque
    // vive en MongoDB, no en el MemoryStore del rate-limiter por IP). Cooldown
    // de 5 minutos + tope de 5 envíos/24h por cuenta. En exceso se responde el
    // 200 genérico del controller sin crear token ni enviar correo.
    const ahora = new Date();
    const [reciente, enviadosUltimas24h] = await Promise.all([
      PasswordResetToken.findOne({
        usuario_id: usuario._id,
        fecha_creacion: { $gte: new Date(ahora.getTime() - 5 * 60 * 1000) }
      }).select('_id').lean(),
      PasswordResetToken.countDocuments({
        usuario_id: usuario._id,
        fecha_creacion: { $gte: new Date(ahora.getTime() - 24 * 60 * 60 * 1000) }
      })
    ]);
    if (reciente || enviadosUltimas24h >= 5) {
      return;
    }

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
  if (!token || !nuevaPassword || typeof token !== 'string' || typeof nuevaPassword !== 'string') {
    throw new AppError(400, 'Token y nueva contraseña requeridos');
  }

  if (!isValidPasswordLength(nuevaPassword, 8)) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres');
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
  if (!currentPassword || !nuevaPassword || typeof currentPassword !== 'string' || typeof nuevaPassword !== 'string') {
    throw new AppError(400, 'Contraseña actual y nueva contraseña requeridas');
  }

  if (!isValidPasswordLength(nuevaPassword, 8)) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres');
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
