const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const scopeTiendaMiddleware = require('../../middlewares/scopeTiendaMiddleware');
const { requireRol } = require('../../middlewares/roleMiddleware');
const {
  metrics,
  perfilPaciente,
  progresoPaciente,
  testInicialPaciente,
  actividadesPaciente,
  listarPacientes,
  reporteUsuarios,
  graficaSemanal,
  crearAdminNegocio,
  crearModeradorTienda,
  listarAdminsNegocio,
  getAdminNegocio,
  actualizarAdminNegocio,
  eliminarAdminNegocio,
  listarModeradoresTienda,
  getModeradorTienda,
  actualizarModeradorTienda,
  eliminarModeradorTienda
} = require('./admin.controller');

const router = Router();

// Auth + verificar que es algún tipo de admin + scope
router.use(authMiddleware, adminMiddleware, scopeTiendaMiddleware);

// ── Crear moderador — accesible para admin_negocio Y admin_general ───────────
// Debe declararse ANTES del requireRol global de abajo

/**
 * @swagger
 * /api/admin/usuarios/moderador-tienda:
 *   post:
 *     summary: "[ADMIN NEGOCIO / ADMIN GENERAL] Crear moderador de tienda"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *               - password
 *               - tienda_id
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               tienda_id:
 *                 type: string
 *                 description: ID de la tienda que administrará el moderador
 *     responses:
 *       201:
 *         description: Moderador creado
 *       400:
 *         description: Datos inválidos o tienda inexistente
 *       403:
 *         description: Tienda fuera del scope del admin_negocio
 *       409:
 *         description: El email ya está registrado
 */
router.post('/usuarios/moderador-tienda', crearModeradorTienda);

// ── CRUD Moderador — accesible para admin_negocio Y admin_general ────────────
// Todas ANTES del requireRol global de abajo

/**
 * @swagger
 * /api/admin/usuarios/moderador-tienda:
 *   get:
 *     summary: "[ADMIN NEGOCIO / ADMIN GENERAL] Listar moderadores de tienda"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de moderadores dentro del scope
 */
router.get('/usuarios/moderador-tienda', listarModeradoresTienda);

/**
 * @swagger
 * /api/admin/usuarios/moderador-tienda/{usuarioId}:
 *   get:
 *     summary: "[ADMIN NEGOCIO / ADMIN GENERAL] Detalle de un moderador"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderador encontrado
 *       404:
 *         description: Moderador no encontrado o fuera de scope
 */
router.get('/usuarios/moderador-tienda/:usuarioId', getModeradorTienda);

/**
 * @swagger
 * /api/admin/usuarios/moderador-tienda/{usuarioId}:
 *   put:
 *     summary: "[ADMIN NEGOCIO / ADMIN GENERAL] Actualizar moderador de tienda"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               tienda_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Moderador actualizado
 *       404:
 *         description: Moderador no encontrado o fuera de scope
 */
router.put('/usuarios/moderador-tienda/:usuarioId', actualizarModeradorTienda);

/**
 * @swagger
 * /api/admin/usuarios/moderador-tienda/{usuarioId}:
 *   delete:
 *     summary: "[ADMIN NEGOCIO / ADMIN GENERAL] Eliminar moderador de tienda"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderador eliminado
 *       404:
 *         description: Moderador no encontrado o fuera de scope
 */
router.delete('/usuarios/moderador-tienda/:usuarioId', eliminarModeradorTienda);

// ── Guard: a partir de aquí solo admin_negocio y admin_general ───────────────
router.use(requireRol('admin_negocio', 'admin_general'));

/**
 * @swagger
 * /api/admin/dashboard/metrics:
 *   get:
 *     summary: "[ADMIN] Métricas del panel de administración"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas agrupadas por tienda
 *       401:
 *         description: Token ausente o inválido
 *       403:
 *         description: Acceso denegado
 */
router.get('/dashboard/metrics', metrics);

// ── Fase C — Pacientes ──────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/pacientes:
 *   get:
 *     summary: "[ADMIN] Listar pacientes (con scoping de tienda)"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista paginada de pacientes con su plan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pacientes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       email:
 *                         type: string
 *                       fecha_registro:
 *                         type: string
 *                       tienda:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                       plan:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           estado:
 *                             type: string
 *                           dia_actual:
 *                             type: number
 *                           racha_dias:
 *                             type: number
 *                 total:
 *                   type: integer
 *                 pagina:
 *                   type: integer
 *       403:
 *         description: Acceso denegado
 */
router.get('/pacientes', listarPacientes);

/**
 * @swagger
 * /api/admin/pacientes/{usuarioId}/perfil:
 *   get:
 *     summary: "[ADMIN] Perfil del paciente (con scoping de tienda)"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Perfil del paciente
 *       404:
 *         description: Paciente no encontrado o fuera de scope
 */
router.get('/pacientes/:usuarioId/perfil', perfilPaciente);

/**
 * @swagger
 * /api/admin/pacientes/{usuarioId}/progreso:
 *   get:
 *     summary: "[ADMIN] Plan de progreso del paciente (con scoping de tienda)"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan de progreso del paciente
 *       404:
 *         description: Paciente no encontrado, fuera de scope o sin plan
 */
router.get('/pacientes/:usuarioId/progreso', progresoPaciente);

/**
 * @swagger
 * /api/admin/pacientes/{usuarioId}/test-inicial:
 *   get:
 *     summary: "[ADMIN] Test inicial del paciente con respuestas enriquecidas"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test inicial del paciente
 *       404:
 *         description: Paciente no encontrado, fuera de scope o sin test
 */
router.get('/pacientes/:usuarioId/test-inicial', testInicialPaciente);

/**
 * @swagger
 * /api/admin/pacientes/{usuarioId}/actividades:
 *   get:
 *     summary: "[ADMIN] Actividades diarias completadas del paciente"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Días completados con contenido de lección
 *       404:
 *         description: Paciente no encontrado, fuera de scope o sin plan
 */
router.get('/pacientes/:usuarioId/actividades', actividadesPaciente);

// ── Fase C — Reportes ───────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/reportes/usuarios:
 *   get:
 *     summary: "[ADMIN] Conteos de usuarios registrados y planes activos"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteos por período (total, semanal, hoy)
 */
router.get('/reportes/usuarios', reporteUsuarios);

/**
 * @swagger
 * /api/admin/reportes/usuarios/grafica-semanal:
 *   get:
 *     summary: "[ADMIN] Actividad diaria de usuarios en los últimos 7 días"
 *     tags: [Admin - Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array de { fecha, cantidad } para los últimos 7 días
 */
router.get('/reportes/usuarios/grafica-semanal', graficaSemanal);

// ── Admin General — Usuarios ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/usuarios/admin-negocio:
 *   get:
 *     summary: "[ADMIN GENERAL] Listar administradores de negocio"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de administradores de negocio
 */
router.get('/usuarios/admin-negocio', listarAdminsNegocio);

/**
 * @swagger
 * /api/admin/usuarios/admin-negocio:
 *   post:
 *     summary: "[ADMIN GENERAL] Crear administrador de negocio"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *               - password
 *               - tiendas_administradas
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               tiendas_administradas:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: IDs de las tiendas que administrará
 *     responses:
 *       201:
 *         description: Admin de negocio creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nombre:
 *                   type: string
 *                 email:
 *                   type: string
 *                 rol:
 *                   type: string
 *                   example: admin_negocio
 *                 tiendas_administradas:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Datos inválidos o tiendas inexistentes
 *       403:
 *         description: Solo admin_general
 *       409:
 *         description: El email ya está registrado
 */
router.post('/usuarios/admin-negocio', crearAdminNegocio);

/**
 * @swagger
 * /api/admin/usuarios/admin-negocio/{usuarioId}:
 *   get:
 *     summary: "[ADMIN GENERAL] Detalle de un administrador de negocio"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Administrador encontrado
 *       404:
 *         description: Administrador no encontrado
 */
router.get('/usuarios/admin-negocio/:usuarioId', getAdminNegocio);

/**
 * @swagger
 * /api/admin/usuarios/admin-negocio/{usuarioId}:
 *   put:
 *     summary: "[ADMIN GENERAL] Actualizar administrador de negocio"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               tiendas_administradas:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Administrador actualizado
 *       404:
 *         description: Administrador no encontrado
 */
router.put('/usuarios/admin-negocio/:usuarioId', actualizarAdminNegocio);

/**
 * @swagger
 * /api/admin/usuarios/admin-negocio/{usuarioId}:
 *   delete:
 *     summary: "[ADMIN GENERAL] Eliminar administrador de negocio"
 *     tags: [Admin - Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Administrador eliminado
 *       404:
 *         description: Administrador no encontrado
 */
router.delete('/usuarios/admin-negocio/:usuarioId', eliminarAdminNegocio);

module.exports = router;
