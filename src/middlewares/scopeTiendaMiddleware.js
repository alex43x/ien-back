const AppError = require('../utils/AppError');

/**
 * Corre después de authMiddleware + adminMiddleware.
 * adminMiddleware ya enriquece req.usuario con { rol, tiendas_administradas, tienda_moderada }.
 *
 * Expone req.tiendasPermitidas:
 *   - null        → admin_general (sin restricciones)
 *   - Array(n)    → admin_negocio (ObjectIds de tiendas en su scope)
 *   - Array(1)    → moderador_tienda (solo su tienda_moderada)
 */
function scopeTiendaMiddleware(req, _res, next) {
  if (!req.usuario?.rol) {
    return next(new AppError(403, 'Rol de usuario no disponible'));
  }

  if (req.usuario.rol === 'admin_general') {
    req.tiendasPermitidas = null;
  } else if (req.usuario.rol === 'moderador_tienda') {
    // Array de un elemento: reutiliza la lógica de filtrado existente
    // sin modificar los controladores de código/producto
    req.tiendasPermitidas = req.usuario.tienda_moderada
      ? [req.usuario.tienda_moderada]
      : [];
  } else {
    // admin_negocio: usar tiendas_administradas ya cargadas por adminMiddleware
    req.tiendasPermitidas = req.usuario.tiendas_administradas || [];
  }

  next();
}

module.exports = scopeTiendaMiddleware;
