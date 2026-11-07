const { resetStreaksYNotificar, sendReminders, enviarActivationNudges, enviarRecoveryEmails, abandonarPlanesYNotificar, reiniciarPlanesYNotificar } = require('./job.service');
const { tryCatch } = require('../../middlewares/errorHandler');
const AppError = require('../../utils/AppError');

exports.resetStreaks = tryCatch(async (_req, res) => {
  const result = await resetStreaksYNotificar();
  res.json(result);
});

exports.sendReminders = tryCatch(async (_req, res) => {
  const result = await sendReminders();
  res.json(result);
});

exports.sendActivationNudge = tryCatch(async (_req, res) => {
  const result = await enviarActivationNudges();
  res.json(result);
});

exports.sendRecovery = tryCatch(async (_req, res) => {
  const result = await enviarRecoveryEmails();
  res.json(result);
});

exports.abandonPlans = tryCatch(async (_req, res) => {
  const result = await abandonarPlanesYNotificar();
  res.json(result);
});

exports.restartPlans = tryCatch(async (_req, res) => {
  const result = await reiniciarPlanesYNotificar();
  res.json(result);
});

exports.runDaily = tryCatch(async (_req, res) => {
  // Orden importa: primero abandonar (30d) y luego reiniciar (7d), así un plan
  // que ya lleva 30 días no se reinicia antes de ser abandonado.
  // AUD-04: antes ambos corrían dentro del mismo Promise.all, sin orden real:
  // a veces el reinicio ganaba, borraba las respuestas y el paciente recibía
  // "plan reiniciado" y "plan abandonado" a la vez. Ahora son secuenciales.
  const abandon = await abandonarPlanesYNotificar();
  const restart = await reiniciarPlanesYNotificar();
  const [reset, nudges, recovery] = await Promise.all([
    resetStreaksYNotificar(),
    enviarActivationNudges(),
    enviarRecoveryEmails()
  ]);
  res.json({ abandon, restart, reset, nudges, recovery });
});
