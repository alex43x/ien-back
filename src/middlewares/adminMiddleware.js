const Usuario = require('../models/Usuario');
const Tienda = require('../models/Tienda');
const { tryCatch } = require('./errorHandler');
const AppError = require('../utils/AppError');

const ROLES_ADMIN = ['admin_general', 'admin_negocio', 'moderador_tienda'];

const adminMiddleware = tryCatch(async (req, _res, next) => {
  const usuario = await Usuario.findById(req.usuario.id)
    .select('rol grupo_id tienda_moderada')
    .lean();
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) {
    throw new AppError(403, 'Acceso denegado');
  }

  req.usuario.rol = usuario.rol;
  req.usuario.tienda_moderada = usuario.tienda_moderada;

  if (usuario.rol === 'moderador_tienda' && usuario.tienda_moderada) {
    const tiendaMod = await Tienda.findById(usuario.tienda_moderada).select('grupo_id').lean();
    req.usuario.grupo_id = tiendaMod ? tiendaMod.grupo_id : null;
  } else {
    req.usuario.grupo_id = usuario.grupo_id;
  }

  next();
});

module.exports = adminMiddleware;
