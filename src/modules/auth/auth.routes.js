const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { validateCode, register, login, refresh, logout, profile, forgotPassword, verifyResetToken, resetPassword, changePassword } = require('./auth.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = Router();

const noop = (_req, _res, next) => next();
const isTest = process.env.NODE_ENV === 'test';

const authLimiter = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intentá de nuevo en 15 minutos' }
});

const resetLimiter = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación, intentá de nuevo en 15 minutos' }
});

const verifyResetLimiter = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas, intentá de nuevo en 15 minutos' }
});

const resetPasswordLimiter = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intentá de nuevo en 15 minutos' }
});

/**
 * @swagger
 * /api/auth/validate-code:
 *   post:
 *     summary: Validar código de activación de tienda
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo_activacion]
 *             properties:
 *               codigo_activacion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valido:
 *                   type: boolean
 *                 tienda:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     ciudad:
 *                       type: string
 *       400:
 *         description: Código requerido
 *       404:
 *         description: Código inválido
 */
router.post('/validate-code', authLimiter, validateCode);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password, codigo_activacion]
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               codigo_activacion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: Token JWT de acceso (15 min de expiración)
 *                 refresh_token:
 *                   type: string
 *                   description: Token de refresco (2 días de expiración, consumible una vez)
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Código de activación inválido
 *       409:
 *         description: Email ya registrado
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: Token JWT de acceso (15 min de expiración)
 *                 refresh_token:
 *                   type: string
 *                   description: Token de refresco (2 días de expiración, consumible una vez)
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Credenciales incorrectas
 *       400:
 *         description: Faltan campos requeridos
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refrescar access token mediante refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nuevo par de tokens (rotación completa)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *       400:
 *         description: Refresh token requerido
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', authLimiter, refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión revocando el refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Sesión cerrada
 *       400:
 *         description: Refresh token requerido
 */
router.post('/logout', authLimiter, logout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Obtener el perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de perfil del usuario logueado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nombre:
 *                   type: string
 *                 email:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 fecha_registro:
 *                   type: string
 *                   format: date-time
 *                 tienda:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre_tienda:
 *                       type: string
 *                     ciudad:
 *                       type: string
 *                 producto:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     descripcion:
 *                       type: string
 *                 tiendas_administradas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nombre_tienda:
 *                         type: string
 *                       ciudad:
 *                         type: string
 *       401:
 *         description: Token no provisto o inválido
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/profile', authMiddleware, profile);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Si el email está registrado, se envía un enlace de recuperación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *       400:
 *         description: Email requerido
 *       429:
 *         description: Demasiadas solicitudes
 */
router.post('/forgot-password', resetLimiter, forgotPassword);

/**
 * @swagger
 * /api/auth/verify-reset-token:
 *   get:
 *     summary: Verificar validez de un token de recuperación
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de recuperación
 *     responses:
 *       200:
 *         description: Resultado de la verificación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valido:
 *                   type: boolean
 *                 email:
 *                   type: string
 *                   description: Email enmascarado si el token es válido
 *       400:
 *         description: Token requerido
 *       429:
 *         description: Demasiadas consultas
 */
router.get('/verify-reset-token', verifyResetLimiter, verifyResetToken);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token de recuperación
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, nueva_password]
 *             properties:
 *               token:
 *                 type: string
 *               nueva_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *       400:
 *         description: Token inválido o expirado
 */
router.post('/reset-password', resetPasswordLimiter, resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Cambiar contraseña (usuario autenticado)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, nueva_password]
 *             properties:
 *               current_password:
 *                 type: string
 *               nueva_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada y sesiones anteriores cerradas
 *       401:
 *         description: Contraseña actual incorrecta
 */
router.post('/change-password', authMiddleware, resetPasswordLimiter, changePassword);

module.exports = router;
