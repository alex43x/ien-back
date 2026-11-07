const { Router } = require('express');
const authMiddleware = require('../../middlewares/authMiddleware');
const adminMiddleware = require('../../middlewares/adminMiddleware');
const scopeTiendaMiddleware = require('../../middlewares/scopeTiendaMiddleware');
const scopeGrupoMiddleware = require('../../middlewares/scopeGrupoMiddleware');
const productoCtrl = require('./producto.controller');

const router = Router();
router.use(authMiddleware, adminMiddleware, scopeTiendaMiddleware, scopeGrupoMiddleware);

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
 *                   grupo_id:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nombre:
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
 *               grupo_id:
 *                 type: string
 *                 description: Solo admin_general puede elegirlo; roles con grupo crean siempre en el propio
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Falta nombre o grupo_id inválido
 *       403:
 *         description: Sin grupo asignado
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
 *               grupo_id:
 *                 type: string
 *                 description: Solo admin_general puede cambiar el grupo
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       400:
 *         description: El grupo indicado no existe
 *       403:
 *         description: Producto fuera de tu grupo, o rol sin permisos para cambiar grupo
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
