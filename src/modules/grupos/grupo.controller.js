const Grupo = require('../../models/Grupo');
const AppError = require('../../utils/AppError');
const { tryCatch } = require('../../middlewares/errorHandler');
const { toResponse } = require('../../utils/toResponse');

/**
 * GET /admin/grupos — solo admin_general
 */
exports.listar = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede listar grupos');
  }
  const grupos = await Grupo.find().select('nombre fecha_creacion').lean();
  res.json(grupos.map(toResponse));
});

/**
 * POST /admin/grupos — solo admin_general
 */
exports.crear = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede crear grupos');
  }
  const { nombre } = req.body;
  if (!nombre) {
    throw new AppError(400, 'nombre es requerido');
  }
  const grupo = await Grupo.create({ nombre });
  res.status(201).json(toResponse(grupo));
});
