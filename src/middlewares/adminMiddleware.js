const Usuario = require('../models/Usuario');
const { tryCatch } = require('./errorHandler');
const AppError = require('../utils/AppError');

const ROLES_ADMIN = ['admin_general', 'admin_negocio', 'moderador_tienda'];

const adminMiddleware = tryCatch(async (req, _res, next) => {
  const usuario = await Usuario.findById(req.usuario.id)
    .select('rol tiendas_administradas tienda_moderada')
    .lean();
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) {
    throw new AppError(403, 'Acceso denegado');
  }
  // Enriquecer req.usuario con datos de rol para middlewares downstream
  req.usuario.rol = usuario.rol;
  req.usuario.tiendas_administradas = usuario.tiendas_administradas;
  req.usuario.tienda_moderada = usuario.tienda_moderada;
  next();
});

module.exports = adminMiddleware;
