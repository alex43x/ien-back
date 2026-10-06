const AppError = require('../utils/AppError');
const Tienda = require('../models/Tienda');
const { tryCatch } = require('./errorHandler');

/**
 * Corre después de authMiddleware + adminMiddleware.
 * adminMiddleware ya enriquece req.usuario con { rol, grupo_id, tienda_moderada }.
 *
 * Expone req.tiendasPermitidas:
 *   - null        → admin_general (sin restricciones)
 *   - Array(n)    → admin_negocio (todas las tiendas de SU grupo)
 *   - Array(1)    → moderador_tienda (solo su tienda_moderada)
 *   - Array(0)    → admin_negocio sin grupo (fail closed)
 */
const scopeTiendaMiddleware = tryCatch(async (req, _res, next) => {
  if (!req.usuario?.rol) {
    throw new AppError(403, 'Rol de usuario no disponible');
  }

  if (req.usuario.rol === 'admin_general') {
    req.tiendasPermitidas = null;
  } else if (req.usuario.rol === 'moderador_tienda') {
    req.tiendasPermitidas = req.usuario.tienda_moderada ? [req.usuario.tienda_moderada] : [];
  } else {
    if (!req.usuario.grupo_id) {
      req.tiendasPermitidas = [];
    } else {
      const tiendas = await Tienda.find({ grupo_id: req.usuario.grupo_id }).select('_id').lean();
      req.tiendasPermitidas = tiendas.map(t => t._id);
    }
  }

  next();
});

module.exports = scopeTiendaMiddleware;
