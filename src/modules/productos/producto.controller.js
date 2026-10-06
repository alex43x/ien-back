const Producto = require('../../models/Producto');
const Grupo = require('../../models/Grupo');
const AppError = require('../../utils/AppError');
const { tryCatch } = require('../../middlewares/errorHandler');
const { toResponse } = require('../../utils/toResponse');

/**
 * GET /admin/productos
 * req.grupoPermitido: null = admin_general | ObjectId = grupo propio | undefined = sin acceso
 */
exports.listar = tryCatch(async (req, res) => {
  if (req.grupoPermitido === undefined) {
    return res.json([]);
  }
  const filtro = {};
  if (req.grupoPermitido !== null) {
    filtro.grupo_id = req.grupoPermitido;
  }
  const productos = await Producto.find(filtro)
    .populate('grupo_id', 'nombre');
  res.json(productos.map(toResponse));
});

/**
 * POST /admin/productos
 * Roles con grupo (admin_negocio/moderador) crean SIEMPRE en su grupo:
 * cualquier grupo_id del body se ignora. admin_general debe enviarlo.
 */
exports.crear = tryCatch(async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) throw new AppError(400, 'nombre es requerido');

  if (req.grupoPermitido === undefined) {
    throw new AppError(403, 'No tenés un grupo asignado');
  }

  let grupo_id;
  if (req.grupoPermitido !== null) {
    grupo_id = req.grupoPermitido;
  } else {
    grupo_id = req.body.grupo_id;
    if (!grupo_id) throw new AppError(400, 'grupo_id es requerido');
    const grupoExiste = await Grupo.findById(grupo_id).select('_id').lean();
    if (!grupoExiste) throw new AppError(400, 'El grupo indicado no existe');
  }

  const producto = await Producto.create({ nombre, descripcion, grupo_id });
  res.status(201).json(toResponse(producto));
});

/**
 * PUT /admin/productos/:id
 * Cambiar de grupo es exclusivo de admin_general: cualquier otro rol que
 * envíe grupo_id recibe 403, incluso si el valor coincide con su propio grupo.
 */
exports.actualizar = tryCatch(async (req, res) => {
  const producto = await Producto.findById(req.params.id).select('nombre descripcion grupo_id');
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  if (req.grupoPermitido === undefined) {
    throw new AppError(403, 'Sin acceso a este producto');
  }
  if (req.grupoPermitido !== null && producto.grupo_id.toString() !== req.grupoPermitido.toString()) {
    throw new AppError(403, 'Sin acceso a este producto');
  }

  const { nombre, descripcion } = req.body;
  if (req.body.grupo_id !== undefined) {
    if (req.grupoPermitido !== null) {
      throw new AppError(403, 'Solo admin_general puede cambiar el grupo de un producto');
    }
    const grupoExiste = await Grupo.findById(req.body.grupo_id).select('_id').lean();
    if (!grupoExiste) throw new AppError(400, 'El grupo indicado no existe');
    producto.grupo_id = req.body.grupo_id;
  }

  if (nombre !== undefined) producto.nombre = nombre;
  if (descripcion !== undefined) producto.descripcion = descripcion;
  await producto.save();
  res.json(toResponse(producto));
});

/**
 * DELETE /admin/productos/:id
 */
exports.eliminar = tryCatch(async (req, res) => {
  const producto = await Producto.findById(req.params.id).select('grupo_id');
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  if (req.grupoPermitido === undefined) {
    throw new AppError(403, 'Sin acceso a este producto');
  }
  if (req.grupoPermitido !== null && producto.grupo_id.toString() !== req.grupoPermitido.toString()) {
    throw new AppError(403, 'Sin acceso a este producto');
  }

  await producto.deleteOne();
  res.json({ mensaje: 'Producto eliminado' });
});
