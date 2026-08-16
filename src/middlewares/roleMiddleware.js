const AppError = require('../utils/AppError');

/**
 * Factory que devuelve un middleware de guardia de rol.
 *
 * Uso:
 *   router.use(requireRol('admin_negocio', 'admin_general'));
 *
 * Debe colocarse DESPUÉS de adminMiddleware (que ya cargó req.usuario.rol).
 *
 * @param {...string} rolesPermitidos - Roles que tienen acceso.
 * @returns {Function} Middleware de Express.
 */
function requireRol(...rolesPermitidos) {
  return function guardRol(req, _res, next) {
    if (!rolesPermitidos.includes(req.usuario?.rol)) {
      return next(new AppError(403, 'Acceso denegado para este rol'));
    }
    next();
  };
}

module.exports = { requireRol };
