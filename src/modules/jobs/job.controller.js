const { ejecutarTransicion, resetStreaksYNotificar, sendReminders, enviarActivationNudges, enviarRecoveryEmails, abandonarPlanesYNotificar, reiniciarPlanesYNotificar } = require('./job.service');
const { tryCatch } = require('../../middlewares/errorHandler');

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
  // El evaluador decide una sola transición por intento y prioriza abandono.
  const mantenimiento = await ejecutarTransicion();
  const nudges = await enviarActivationNudges();
  const recovery = await enviarRecoveryEmails();
  res.json({ mantenimiento, nudges, recovery });
});
