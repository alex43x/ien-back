const { demoledorDeRachas, findUsuariosRezagados, findUsuariosSinActivar, findUsuariosParaRecuperar } = require('./cronJobs');
const { enviarEnLote, yaSeEnviaronBatch } = require('../email/email.service');
const { recordatorioDiario, urgenciaActivacion, recuperacionInactividad } = require('../email/templates');

async function sendReminders() {
  const ahora = new Date();
  const horaUtcActual = ahora.getUTCHours();
  const minutoUtcActual = ahora.getUTCMinutes();
  const usuarios = await findUsuariosRezagados(horaUtcActual, minutoUtcActual);
  if (usuarios.length === 0) {
    return { enviados: 0, fallidos: 0, saltados: 0, total: 0 };
  }
  const ids = usuarios.map(u => (u.usuario_id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'recordatorio_diario', true);
  return enviarEnLote(usuarios, {
    tipo_correo: 'recordatorio_diario',
    renderFn: (u) => ({ ...recordatorioDiario(u.nombre, u.dia_actual), meta: { dia_actual: u.dia_actual, racha_dias: u.racha_dias } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id).toString())
  });
}

async function ejecutarTransicion(tipo) {
  const result = await require('../plan/intentos.service').evaluar({ tipo });
  const avisos = await require('./avisos.service').procesarAvisos();
  return { ...result, ...avisos, matchedCount: result.aplicados.length,
    modifiedCount: result.aplicados.length, usuarios_afectados: result.aplicados,
    abandonados: result.aplicados.filter(e => e.tipo === 'plan_abandonado').length,
    reiniciados: result.aplicados.filter(e => e.tipo === 'plan_reiniciado').length,
    notificados: avisos.enviados };
}
async function resetStreaksYNotificar() { return ejecutarTransicion('racha_rota'); }

async function enviarActivationNudges() {
  const usuarios = await findUsuariosSinActivar();
  const ids = usuarios.map(u => (u.usuario_id || u._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'urgencia_activacion');
  return enviarEnLote(usuarios, {
    tipo_correo: 'urgencia_activacion',
    renderFn: (u) => urgenciaActivacion(u.nombre),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });
}

async function enviarRecoveryEmails() {
  const usuarios = await findUsuariosParaRecuperar();
  const ids = usuarios.map(u => (u.usuario_id || u._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'recuperacion_inactividad');
  return enviarEnLote(usuarios, {
    tipo_correo: 'recuperacion_inactividad',
    renderFn: (u) => ({ ...recuperacionInactividad(u.nombre, u.dia_actual), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });
}

/**
 * Marca como abandonado (estado='abandonado') a los planes activos sin
 * actividad por 30+ días, y notifica por correo a cada usuario.
 */
async function abandonarPlanesYNotificar() { return ejecutarTransicion('plan_abandonado'); }
async function reiniciarPlanesYNotificar() { return ejecutarTransicion('plan_reiniciado'); }

module.exports = {
  ejecutarTransicion,
  demoledorDeRachas,
  sendReminders,
  resetStreaksYNotificar,
  enviarActivationNudges,
  enviarRecoveryEmails,
  abandonarPlanesYNotificar,
  reiniciarPlanesYNotificar
};
