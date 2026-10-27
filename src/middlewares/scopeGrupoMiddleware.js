/**
 * Define req.grupoPermitido para el catálogo (Producto) compartible por grupo.
 * Corre después de adminMiddleware, que ya resolvió req.usuario.grupo_id
 * (directo para admin_negocio, derivado de su tienda para moderador_tienda).
 *
 * Semántica tri-estado (fail closed):
 *   - null      → admin_general, sin restricción
 *   - ObjectId  → grupo propio: solo se ve/edita catálogo de ese grupo
 *   - undefined → rol de scope sin grupo resuelto: nada de lectura, 403 en escritura
 */
function scopeGrupoMiddleware(req, _res, next) {
  if (req.usuario.rol === 'admin_general') {
    req.grupoPermitido = null;
  } else if (req.usuario.grupo_id) {
    req.grupoPermitido = req.usuario.grupo_id;
  } else {
    req.grupoPermitido = undefined;
  }
  next();
}

module.exports = scopeGrupoMiddleware;
