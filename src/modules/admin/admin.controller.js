const {
  panelAdminPorTienda,
  crearAdminNegocio,
  crearModeradorTienda,
  getPerfilPaciente,
  getProgresoPaciente,
  getTestInicialPaciente,
  getActividadesPaciente,
  getReporteUsuarios,
  getGraficaSemanal,
  listarPacientes,
  listarAdminsNegocio,
  getAdminNegocio,
  actualizarAdminNegocio,
  eliminarAdminNegocio,
  listarModeradoresTienda,
  getModeradorTienda,
  actualizarModeradorTienda,
  eliminarModeradorTienda
} = require('./admin.service');
const { tryCatch } = require('../../middlewares/errorHandler');
const AppError = require('../../utils/AppError');

exports.metrics = tryCatch(async (req, res) => {
  const data = await panelAdminPorTienda(req.tiendasPermitidas);
  res.json(data);
});

exports.perfilPaciente = tryCatch(async (req, res) => {
  const data = await getPerfilPaciente(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});

exports.progresoPaciente = tryCatch(async (req, res) => {
  const data = await getProgresoPaciente(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});

exports.testInicialPaciente = tryCatch(async (req, res) => {
  const data = await getTestInicialPaciente(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});

exports.actividadesPaciente = tryCatch(async (req, res) => {
  const data = await getActividadesPaciente(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});

exports.reporteUsuarios = tryCatch(async (req, res) => {
  const data = await getReporteUsuarios(req.tiendasPermitidas);
  res.json(data);
});

exports.graficaSemanal = tryCatch(async (req, res) => {
  const data = await getGraficaSemanal(req.tiendasPermitidas);
  res.json(data);
});

exports.crearAdminNegocio = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede crear administradores de negocio');
  }
  const result = await crearAdminNegocio(req.body);
  res.status(201).json(result);
});

exports.crearModeradorTienda = tryCatch(async (req, res) => {
  if (!['admin_negocio', 'admin_general'].includes(req.usuario.rol)) {
    throw new AppError(403, 'Sin permisos para crear moderadores de tienda');
  }
  const result = await crearModeradorTienda(req.body, req.usuario);
  res.status(201).json(result);
});

exports.listarPacientes = tryCatch(async (req, res) => {
  const pagina = Math.max(parseInt(req.query.page) || 1, 1);
  const limite = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const data = await listarPacientes(pagina, limite, req.tiendasPermitidas);
  res.json(data);
});

// ─── CRUD Admin Negocio ──────────────────────────────────────────────────────

exports.listarAdminsNegocio = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede listar administradores de negocio');
  }
  const data = await listarAdminsNegocio();
  res.json(data);
});

exports.getAdminNegocio = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede ver administradores de negocio');
  }
  const data = await getAdminNegocio(req.params.usuarioId);
  res.json(data);
});

exports.actualizarAdminNegocio = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede modificar administradores de negocio');
  }
  const data = await actualizarAdminNegocio(req.params.usuarioId, req.body);
  res.json(data);
});

exports.eliminarAdminNegocio = tryCatch(async (req, res) => {
  if (req.usuario.rol !== 'admin_general') {
    throw new AppError(403, 'Solo admin_general puede eliminar administradores de negocio');
  }
  const data = await eliminarAdminNegocio(req.params.usuarioId, req.usuario.id);
  res.json(data);
});

// ─── CRUD Moderador Tienda ───────────────────────────────────────────────────

exports.listarModeradoresTienda = tryCatch(async (req, res) => {
  if (!['admin_negocio', 'admin_general'].includes(req.usuario.rol)) {
    throw new AppError(403, 'Sin permisos para listar moderadores');
  }
  const data = await listarModeradoresTienda(req.tiendasPermitidas);
  res.json(data);
});

exports.getModeradorTienda = tryCatch(async (req, res) => {
  if (!['admin_negocio', 'admin_general'].includes(req.usuario.rol)) {
    throw new AppError(403, 'Sin permisos para ver moderadores');
  }
  const data = await getModeradorTienda(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});

exports.actualizarModeradorTienda = tryCatch(async (req, res) => {
  if (!['admin_negocio', 'admin_general'].includes(req.usuario.rol)) {
    throw new AppError(403, 'Sin permisos para modificar moderadores');
  }
  const data = await actualizarModeradorTienda(req.params.usuarioId, req.body, req.tiendasPermitidas);
  res.json(data);
});

exports.eliminarModeradorTienda = tryCatch(async (req, res) => {
  if (!['admin_negocio', 'admin_general'].includes(req.usuario.rol)) {
    throw new AppError(403, 'Sin permisos para eliminar moderadores');
  }
  const data = await eliminarModeradorTienda(req.params.usuarioId, req.tiendasPermitidas);
  res.json(data);
});
