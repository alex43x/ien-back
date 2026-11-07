const Codigo = require('../../models/Codigo');
const Producto = require('../../models/Producto');
const Tienda = require('../../models/Tienda');
const AppError = require('../../utils/AppError');
const { tryCatch } = require('../../middlewares/errorHandler');
const { toResponse } = require('../../utils/toResponse');

const { enScope } = require('../../utils/scope');
/**
 * GET /admin/codigos
 */
exports.listar = tryCatch(async (req, res) => {
  let filtro = {};
  if (req.tiendasPermitidas !== null) {
    filtro.tienda_id = { $in: req.tiendasPermitidas };
  }
  const codigos = await Codigo.find(filtro)
    .select('codigo producto_id tienda_id activo fecha_creacion fecha_activacion')
    .populate('tienda_id', 'nombre_tienda ciudad activo')
    .populate('producto_id', 'nombre');
  res.json(codigos.map(toResponse));
});

/**
 * POST /admin/codigos
 */
exports.crear = tryCatch(async (req, res) => {
  const { codigo, producto_id, tienda_id } = req.body;
  if (!codigo || !producto_id || !tienda_id) {
    throw new AppError(400, 'codigo, producto_id y tienda_id son requeridos');
  }

  if (req.tiendasPermitidas !== null) {
    if (!enScope(tienda_id, req.tiendasPermitidas)) throw new AppError(403, 'No puedes crear códigos para esa tienda');
  }

  const producto = await Producto.findById(producto_id).select('grupo_id').lean();
  if (!producto) throw new AppError(400, 'Producto no encontrado');

  const tiendaDoc = await Tienda.findById(tienda_id).select('grupo_id').lean();
  if (!tiendaDoc) throw new AppError(400, 'La tienda indicada no existe');

  if (producto.grupo_id.toString() !== tiendaDoc.grupo_id.toString()) {
    throw new AppError(400, 'El producto no pertenece al grupo de la tienda indicada');
  }

  let doc;
  try {
    doc = await Codigo.create({ codigo, producto_id, tienda_id, activo: true });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'El código ya existe');
    }
    throw err;
  }
  res.status(201).json(toResponse(doc));
});

/**
 * PATCH /admin/codigos/:id/activar
 */
exports.activar = tryCatch(async (req, res) => {
  const doc = await Codigo.findById(req.params.id).select('tienda_id activo codigo');
  if (!doc) throw new AppError(404, 'Código no encontrado');
  if (!enScope(doc.tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Sin acceso a este código');
  }
  doc.activo = true;
  await doc.save();
  res.json({ mensaje: 'Código activado', codigo: toResponse(doc) });
});

/**
 * PATCH /admin/codigos/:id/desactivar
 */
exports.desactivar = tryCatch(async (req, res) => {
  const doc = await Codigo.findById(req.params.id).select('tienda_id activo codigo');
  if (!doc) throw new AppError(404, 'Código no encontrado');
  if (!enScope(doc.tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Sin acceso a este código');
  }
  doc.activo = false;
  await doc.save();
  res.json({ mensaje: 'Código desactivado', codigo: toResponse(doc) });
});
