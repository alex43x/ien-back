const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const scopeTiendaMiddleware = require('../../middlewares/scopeTiendaMiddleware');
const productoCtrl = require('./producto.controller');

const router = Router();
router.use(authMiddleware, adminMiddleware, scopeTiendaMiddleware);

/**
 * @swagger
 * /api/admin/productos:
 *   get:
 *     summary: "[ADMIN] Listar productos (con scoping)"
 *     tags: [Admin - Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de productos en scope
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
 *                   descripcion:
 *                     type: string
 *                   tienda_id:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nombre_tienda:
 *                         type: string
 *                       ciudad:
 *                         type: string
 */
router.get('/', productoCtrl.listar);

/**
 * @swagger
 * /api/admin/productos:
 *   post:
 *     summary: "[ADMIN] Crear un nuevo producto"
 *     tags: [Admin - Productos]
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
 *               descripcion:
 *                 type: string
 *               tienda_id:
 *                 type: string
 *                 description: ID de la tienda a asociar
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Falta nombre
 *       403:
 *         description: Intento de asignar tienda fuera de scope
 */
router.post('/', productoCtrl.crear);

/**
 * @swagger
 * /api/admin/productos/{id}:
 *   put:
 *     summary: "[ADMIN] Actualizar un producto"
 *     tags: [Admin - Productos]
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
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               tienda_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       403:
 *         description: Fuera de scope o intento de asignar tienda fuera de scope
 *       404:
 *         description: Producto no encontrado
 */
router.put('/:id', productoCtrl.actualizar);

/**
 * @swagger
 * /api/admin/productos/{id}:
 *   delete:
 *     summary: "[ADMIN] Eliminar un producto"
 *     tags: [Admin - Productos]
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
 *         description: Producto eliminado
 *       403:
 *         description: Fuera de scope
 *       404:
 *         description: Producto no encontrado
 */
router.delete('/:id', productoCtrl.eliminar);

module.exports = router;
