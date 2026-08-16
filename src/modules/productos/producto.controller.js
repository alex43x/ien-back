const Producto = require('../../models/Producto');
const Tienda = require('../../models/Tienda');
const AppError = require('../../utils/AppError');
const { tryCatch } = require('../../middlewares/errorHandler');
const { enScope } = require('../../utils/scope');
const { toResponse } = require('../../utils/toResponse');

/**
 * GET /admin/productos
 */
exports.listar = tryCatch(async (req, res) => {
  let filtro = {};
  if (req.tiendasPermitidas !== null) {
    filtro.tienda_id = { $in: req.tiendasPermitidas };
  }
  const productos = await Producto.find(filtro)
    .populate('tienda_id', 'nombre_tienda ciudad');
  res.json(productos.map(toResponse));
});

/**
 * POST /admin/productos
 */
exports.crear = tryCatch(async (req, res) => {
  const { nombre, descripcion, tienda_id } = req.body;
  if (!nombre) throw new AppError(400, 'nombre es requerido');

  if (!enScope(tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Solo puedes asignar una tienda dentro de tu scope');
  }

  const tiendaExiste = await Tienda.findById(tienda_id).select('_id').lean();
  if (!tiendaExiste) throw new AppError(400, 'La tienda indicada no existe');

  const producto = await Producto.create({ nombre, descripcion, tienda_id });
  res.status(201).json(toResponse(producto));
});

/**
 * PUT /admin/productos/:id
 */
exports.actualizar = tryCatch(async (req, res) => {
  const producto = await Producto.findById(req.params.id).select('nombre descripcion tienda_id');
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  if (!enScope(producto.tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Sin acceso a este producto');
  }

  const { nombre, descripcion, tienda_id } = req.body;
  if (tienda_id && !enScope(tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Solo puedes asignar una tienda dentro de tu scope');
  }

  if (nombre !== undefined) producto.nombre = nombre;
  if (descripcion !== undefined) producto.descripcion = descripcion;
  if (tienda_id !== undefined) {
      const tiendaExiste = await Tienda.findById(tienda_id).select('_id').lean();
      if (!tiendaExiste) throw new AppError(400, 'La tienda indicada no existe');
      producto.tienda_id = tienda_id;
  }
  await producto.save();
  res.json(toResponse(producto));
});

/**
 * DELETE /admin/productos/:id
 */
exports.eliminar = tryCatch(async (req, res) => {
  const producto = await Producto.findById(req.params.id).select('tienda_id');
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  if (!enScope(producto.tienda_id, req.tiendasPermitidas)) {
    throw new AppError(403, 'Sin acceso a este producto');
  }

  await producto.deleteOne();
  res.json({ mensaje: 'Producto eliminado' });
});
