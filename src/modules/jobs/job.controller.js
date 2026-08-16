const { resetStreaksYNotificar, sendReminders, enviarActivationNudges, enviarRecoveryEmails } = require('./job.service');
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

exports.runDaily = tryCatch(async (_req, res) => {
  const [reset, nudges, recovery] = await Promise.all([
    resetStreaksYNotificar(),
    enviarActivationNudges(),
    enviarRecoveryEmails()
  ]);
  res.json({ reset, nudges, recovery });
});
