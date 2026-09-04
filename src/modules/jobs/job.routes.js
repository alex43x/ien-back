  const { Router } = require('express');
  const rateLimit = require('express-rate-limit');
const apiKeyMiddleware = require('../../middlewares/apiKeyMiddleware');
<<<<<<< HEAD
const { resetStreaks, sendReminders, sendActivationNudge, sendRecovery, runDaily, abandonPlans, restartPlans } = require('./job.controller');
=======
const { resetStreaks, sendReminders, sendActivationNudge, sendRecovery, runDaily } = require('./job.controller');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

  const router = Router();

  const noop = (_req, _res, next) => next();
  const isTest = process.env.NODE_ENV === 'test';

  const jobLimiter = isTest ? noop : rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas llamadas a jobs, intentá de nuevo en 1 hora' }
  });

  router.use(jobLimiter, apiKeyMiddleware);

/**
 * @swagger
 * /api/jobs/reset-streaks:
 *   post:
 *     summary: Resetear rachas de usuarios inactivos (demoledor de rachas)
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Rachas reseteadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 modifiedCount:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/reset-streaks', resetStreaks);

/**
 * @swagger
 * /api/jobs/send-reminders:
 *   post:
 *     summary: Enviar recordatorio diario a usuarios rezagados y registrar en HistorialCorreo
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Resultado del envío de recordatorios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enviados:
 *                   type: number
 *                 fallidos:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/send-reminders', sendReminders);

/**
 * @swagger
 * /api/jobs/send-activation-nudge:
 *   post:
 *     summary: Enviar nudge de activación a usuarios registrados que nunca activaron el plan
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Resultado del envío de nudges de activación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enviados:
 *                   type: number
 *                 saltados:
 *                   type: number
 *                 total:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/send-activation-nudge', sendActivationNudge);

/**
 * @swagger
 * /api/jobs/send-recovery:
 *   post:
 *     summary: Enviar correo de recuperación a usuarios inactivos por más de 7 días
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Resultado del envío de correos de recuperación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enviados:
 *                   type: number
 *                 saltados:
 *                   type: number
 *                 total:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/send-recovery', sendRecovery);

/**
 * @swagger
<<<<<<< HEAD
 * /api/jobs/abandon-plans:
 *   post:
 *     summary: Marcar como abandonados los planes sin actividad por 30+ días y notificar
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Planes abandonados y correos enviados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 abandonados:
 *                   type: number
 *                 notificados:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/abandon-plans', abandonPlans);

/**
 * @swagger
 * /api/jobs/restart-plans:
 *   post:
 *     summary: Reiniciar (reset parcial) planes sin actividad por 7+ días (día 1, racha 0) y notificar
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Planes reiniciados y correos enviados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reiniciados:
 *                   type: number
 *                 notificados:
 *                   type: number
 *       401:
 *         description: API key inválida
 */
router.post('/restart-plans', restartPlans);

/**
 * @swagger
 * /api/jobs/run-daily:
 *   post:
 *     summary: Ejecutar las tareas diarias nocturnas (abandonar, reiniciar, reset streaks, activation nudges, recovery emails)
=======
 * /api/jobs/run-daily:
 *   post:
 *     summary: Ejecutar las tareas diarias nocturnas (reset streaks, activation nudges, recovery emails)
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
<<<<<<< HEAD
 *         description: Resultado combinado de las 5 tareas
=======
 *         description: Resultado combinado de las 3 tareas
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
<<<<<<< HEAD
 *                 abandon:
 *                   type: object
 *                 restart:
 *                   type: object
=======
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
 *                 reset:
 *                   type: object
 *                 nudges:
 *                   type: object
 *                 recovery:
 *                   type: object
 *       401:
 *         description: API key inválida
 */
router.post('/run-daily', runDaily);

module.exports = router;
