<<<<<<< HEAD
const { resetStreaksYNotificar, sendReminders, enviarActivationNudges, enviarRecoveryEmails, abandonarPlanesYNotificar, reiniciarPlanesYNotificar } = require('./job.service');
=======
const { resetStreaksYNotificar, sendReminders, enviarActivationNudges, enviarRecoveryEmails } = require('./job.service');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
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

<<<<<<< HEAD
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
  const [abandon, restart, reset, nudges, recovery] = await Promise.all([
    abandonarPlanesYNotificar(),
    reiniciarPlanesYNotificar(),
=======
exports.runDaily = tryCatch(async (_req, res) => {
  const [reset, nudges, recovery] = await Promise.all([
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
    resetStreaksYNotificar(),
    enviarActivationNudges(),
    enviarRecoveryEmails()
  ]);
<<<<<<< HEAD
  res.json({ abandon, restart, reset, nudges, recovery });
=======
  res.json({ reset, nudges, recovery });
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
});
