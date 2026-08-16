const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const scopeTiendaMiddleware = require('../../middlewares/scopeTiendaMiddleware');
const codigoCtrl = require('./codigo.controller');

const router = Router();
router.use(authMiddleware, adminMiddleware, scopeTiendaMiddleware);

/**
 * @swagger
 * /api/admin/codigos:
 *   get:
 *     summary: "[ADMIN] Listar códigos de activación (con scoping)"
 *     tags: [Admin - Códigos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de códigos accesibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   codigo:
 *                     type: string
 *                   producto_id:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                   tienda_id:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nombre_tienda:
 *                         type: string
 *                       ciudad:
 *                         type: string
 *                   activo:
 *                     type: boolean
 *                   fecha_creacion:
 *                     type: string
 *                   fecha_activacion:
 *                     type: string
 */
router.get('/', codigoCtrl.listar);

/**
 * @swagger
 * /api/admin/codigos:
 *   post:
 *     summary: "[ADMIN] Crear un nuevo código de activación"
 *     tags: [Admin - Códigos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *               - producto_id
 *               - tienda_id
 *             properties:
 *               codigo:
 *                 type: string
 *                 description: Código único
 *               producto_id:
 *                 type: string
 *                 description: ID del producto asociado
 *               tienda_id:
 *                 type: string
 *                 description: ID de la tienda asociada
 *     responses:
 *       201:
 *         description: Código creado exitosamente
 *       400:
 *         description: Parámetros inválidos
 *       403:
 *         description: Intento de crear código para una tienda fuera de scope
 */
router.post('/', codigoCtrl.crear);

/**
 * @swagger
 * /api/admin/codigos/{id}/activar:
 *   patch:
 *     summary: "[ADMIN] Activar un código de activación"
 *     tags: [Admin - Códigos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Código activado
 *       403:
 *         description: Código fuera de scope
 *       404:
 *         description: Código no encontrado
 */
router.patch('/:id/activar', codigoCtrl.activar);

/**
 * @swagger
 * /api/admin/codigos/{id}/desactivar:
 *   patch:
 *     summary: "[ADMIN] Desactivar un código de activación"
 *     tags: [Admin - Códigos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Código desactivado
 *       403:
 *         description: Código fuera de scope
 *       404:
 *         description: Código no encontrado
 */
router.patch('/:id/desactivar', codigoCtrl.desactivar);

module.exports = router;
