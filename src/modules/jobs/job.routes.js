  const { Router } = require('express');
  const rateLimit = require('express-rate-limit');
const apiKeyMiddleware = require('../../middlewares/apiKeyMiddleware');
const { resetStreaks, sendReminders, sendActivationNudge, sendRecovery, runDaily } = require('./job.controller');

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
 * /api/jobs/run-daily:
 *   post:
 *     summary: Ejecutar las tareas diarias nocturnas (reset streaks, activation nudges, recovery emails)
 *     tags: [Jobs]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Resultado combinado de las 3 tareas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
