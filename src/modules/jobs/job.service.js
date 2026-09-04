<<<<<<< HEAD
const { demoledorDeRachas, findUsuariosRezagados, findUsuariosSinActivar, findUsuariosParaRecuperar, findPlanesParaAbandonar, findPlanesParaReiniciar } = require('./cronJobs');
const PlanProgreso = require('../../models/PlanProgreso');
const Usuario = require('../../models/Usuario');
const { enviarCorreo, enviarEnLote, yaSeEnvio, yaSeEnviaronBatch } = require('../email/email.service');
const { recordatorioDiario, rachaRota, urgenciaActivacion, recuperacionInactividad, planReiniciado, planAbandonado } = require('../email/templates');
=======
const { demoledorDeRachas, findUsuariosRezagados, findUsuariosSinActivar, findUsuariosParaRecuperar } = require('./cronJobs');
const Usuario = require('../../models/Usuario');
const { enviarCorreo, enviarEnLote, yaSeEnvio, yaSeEnviaronBatch } = require('../email/email.service');
const { recordatorioDiario, rachaRota, urgenciaActivacion, recuperacionInactividad } = require('../email/templates');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

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

async function resetStreaksYNotificar() {
  const resultado = await demoledorDeRachas();
  if (resultado.usuarios_afectados.length === 0) return { ...resultado, fallidos: 0 };

  const ids = resultado.usuarios_afectados.map(u => u.usuario_id);
  const usuarios = await Usuario.find({ _id: { $in: ids } }).select('nombre email').lean();
  const usuariosPorId = new Map(usuarios.map(u => [String(u._id), u]));

  const destinatarios = resultado.usuarios_afectados
    .map(a => ({ ...usuariosPorId.get(String(a.usuario_id)), racha_rota: a.racha_rota, usuario_id: a.usuario_id }))
    .filter(u => u.email);

  const { fallidos } = await enviarEnLote(destinatarios, {
    tipo_correo: 'racha_rota',
    renderFn: (u) => ({ ...rachaRota(u.nombre, u.racha_rota), meta: { racha_rota: u.racha_rota } })
  });

  return { ...resultado, fallidos };
}

async function enviarActivationNudges() {
  const usuarios = await findUsuariosSinActivar();
  const ids = usuarios.map(u => (u._id || u.usuario_id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'urgencia_activacion');
  return enviarEnLote(usuarios, {
    tipo_correo: 'urgencia_activacion',
    renderFn: (u) => urgenciaActivacion(u.nombre),
    skipFn: (u) => yaEnviados.has((u._id || u.usuario_id).toString())
  });
}

async function enviarRecoveryEmails() {
  const usuarios = await findUsuariosParaRecuperar();
  const ids = usuarios.map(u => (u._id || u.usuario_id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'recuperacion_inactividad');
  return enviarEnLote(usuarios, {
    tipo_correo: 'recuperacion_inactividad',
    renderFn: (u) => ({ ...recuperacionInactividad(u.nombre, u.dia_actual), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u._id || u.usuario_id).toString())
  });
}

<<<<<<< HEAD
/**
 * Marca como abandonado (estado='abandonado') a los planes activos sin
 * actividad por 30+ días, y notifica por correo a cada usuario.
 */
async function abandonarPlanesYNotificar() {
  const candidatos = await findPlanesParaAbandonar();
  if (candidatos.length === 0) return { abandonados: 0, notificados: 0, fallidos: 0 };

  const planIds = candidatos.map(c => c.plan_id);
  const res = await PlanProgreso.updateMany(
    { _id: { $in: planIds }, estado: 'activo' },
    { $set: { estado: 'abandonado' } }
  );

  const ids = candidatos.map(c => (c.usuario_id || c._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'plan_abandonado');
  const { enviados, fallidos } = await enviarEnLote(candidatos, {
    tipo_correo: 'plan_abandonado',
    renderFn: (u) => ({ ...planAbandonado(u.nombre), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });

  return {
    abandonados: res.modifiedCount,
    notificados: enviados,
    fallidos,
    total_candidatos: candidatos.length
  };
}

/**
 * Reinicia (reset parcial) a los planes activos sin actividad por 7+ días y que
 * ya avanzaron más allá del día 1: vuelve al Día 1 con la racha actual en 0 y el
 * progreso diario regenerado. Conserva racha_maxima e hitos_alcanzados y NO toca
 * ultima_fecha_actividad (así el reloj de 30 días del abandono sigue corriendo).
 * Notifica por correo a cada usuario.
 */
async function reiniciarPlanesYNotificar() {
  const candidatos = await findPlanesParaReiniciar();
  if (candidatos.length === 0) return { reiniciados: 0, notificados: 0, fallidos: 0 };

  const planIds = candidatos.map(c => c.plan_id);
  let reiniciados = 0;
  for (const id of planIds) {
    const r = await PlanProgreso.updateOne(
      { _id: id, estado: 'activo' },
      {
        $set: {
          dia_actual: 1,
          racha_dias: 0,
          progreso_diario: Array.from({ length: 30 }, (_, i) => ({
            dia_numero: i + 1,
            completado: false,
            fecha_completado: null,
            respuesta_usuario: null
          }))
        }
      }
    );
    if (r.modifiedCount > 0) reiniciados++;
  }

  const ids = candidatos.map(c => (c.usuario_id || c._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'plan_reiniciado');
  const { enviados, fallidos } = await enviarEnLote(candidatos, {
    tipo_correo: 'plan_reiniciado',
    renderFn: (u) => ({ ...planReiniciado(u.nombre, u.dia_actual), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });

  return {
    reiniciados,
    notificados: enviados,
    fallidos,
    total_candidatos: candidatos.length
  };
}

module.exports = {
  demoledorDeRachas,
  sendReminders,
  resetStreaksYNotificar,
  enviarActivationNudges,
  enviarRecoveryEmails,
  abandonarPlanesYNotificar,
  reiniciarPlanesYNotificar
};
=======
module.exports = { demoledorDeRachas, sendReminders, resetStreaksYNotificar, enviarActivationNudges, enviarRecoveryEmails };
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
