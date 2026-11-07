const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const { requireRol } = require('../../middlewares/roleMiddleware');
const grupoCtrl = require('./grupo.controller');

const router = Router();
router.use(authMiddleware, adminMiddleware, requireRol('admin_general'));

/**
 * @swagger
 * /api/admin/grupos:
 *   get:
 *     summary: "[ADMIN GENERAL] Listar grupos"
 *     tags: [Admin - Grupos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de grupos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   nombre:
 *                     type: string
 *                   fecha_creacion:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Token no válido o expirado
 *       403:
 *         description: Denegado (solo admin_general)
 */
router.get('/', grupoCtrl.listar);

/**
 * @swagger
 * /api/admin/grupos:
 *   post:
 *     summary: "[ADMIN GENERAL] Crear un grupo"
 *     tags: [Admin - Grupos]
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
 *             properties:
 *               nombre:
 *                 type: string
 *     responses:
 *       201:
 *         description: Grupo creado
 *       400:
 *         description: Falta nombre
 *       403:
 *         description: Denegado (solo admin_general)
 */
router.post('/', grupoCtrl.crear);

module.exports = router;
