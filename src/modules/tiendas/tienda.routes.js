const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const scopeTiendaMiddleware = require('../../middlewares/scopeTiendaMiddleware');
const { requireRol } = require('../../middlewares/roleMiddleware');
const sucursalCtrl = require('./tienda.controller');

const router = Router();
router.use(authMiddleware, adminMiddleware, scopeTiendaMiddleware);

/**
 * @swagger
 * /api/admin/sucursales:
 *   get:
 *     summary: "[ADMIN] Listar sucursales (con scoping)"
 *     tags: [Admin - Tiendas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de sucursales a las que el usuario tiene acceso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   nombre_tienda:
 *                     type: string
 *                   ciudad:
 *                     type: string
 *       401:
 *         description: Token no válido o expirado
 *       403:
 *         description: Acceso no autorizado
 */
router.get('/', sucursalCtrl.listar);

/**
 * @swagger
 * /api/admin/sucursales:
 *   post:
 *     summary: "[ADMIN GENERAL] Crear una nueva sucursal"
 *     tags: [Admin - Tiendas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_tienda
 *               - ciudad
 *             properties:
 *               nombre_tienda:
 *                 type: string
 *               ciudad:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sucursal creada exitosamente
 *       400:
 *         description: Falta nombre_tienda o ciudad
 *       403:
 *         description: Denegado (solo admin_general)
 */
router.post('/', requireRol('admin_general'), sucursalCtrl.crear);

/**
 * @swagger
 * /api/admin/sucursales/{id}:
 *   put:
 *     summary: "[ADMIN] Actualizar sucursal en scope"
 *     tags: [Admin - Tiendas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               nombre_tienda:
 *                 type: string
 *               ciudad:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sucursal actualizada
 *       403:
 *         description: Fuera de scope o sin permisos
 *       404:
 *         description: Sucursal no encontrada
 */
router.put('/:id', requireRol('admin_negocio', 'admin_general'), sucursalCtrl.actualizar);

/**
 * @swagger
 * /api/admin/sucursales/{id}:
 *   delete:
 *     summary: "[ADMIN GENERAL] Eliminar sucursal"
 *     tags: [Admin - Tiendas]
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
 *         description: Sucursal eliminada
 *       403:
 *         description: Denegado (solo admin_general)
 *       404:
 *         description: Sucursal no encontrada
 */
router.delete('/:id', requireRol('admin_negocio', 'admin_general'), sucursalCtrl.eliminar);

/**
 * @swagger
 * /api/admin/sucursales/{id}/reactivar:
 *   patch:
 *     summary: "[ADMIN] Reactivar sucursal desactivada"
 *     tags: [Admin - Tiendas]
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
 *         description: Sucursal reactivada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 tienda:
 *                   type: object
 *       403:
 *         description: Fuera de scope o sin permisos
 *       404:
 *         description: Sucursal no encontrada
 */
router.patch('/:id/reactivar', requireRol('admin_negocio', 'admin_general'), sucursalCtrl.reactivar);

module.exports = router;
