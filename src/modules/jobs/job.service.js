const { auditMutation, auditJob } = require('../auditoria/auditoria');
const { demoledorDeRachas, findUsuariosRezagados, findUsuariosSinActivar, findUsuariosParaRecuperar, findPlanesParaAbandonar, findPlanesParaReiniciar } = require('./cronJobs');
const PlanProgreso = require('../../models/PlanProgreso');
const { archivarYReiniciar, filtroPlanSinCambios } = require('../plan/reinicios.service');
const Usuario = require('../../models/Usuario');
const { enviarCorreo, enviarEnLote, yaSeEnvio, yaSeEnviaronBatch } = require('../email/email.service');
const { recordatorioDiario, rachaRota, urgenciaActivacion, recuperacionInactividad, planReiniciado, planAbandonado } = require('../email/templates');

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

/**
 * Marca como abandonado (estado='abandonado') a los planes activos sin
 * actividad por 30+ días, y notifica por correo a cada usuario.
 */
async function abandonarPlanesYNotificar() {
  const ahora = new Date(Date.now());
  const candidatos = await findPlanesParaAbandonar(ahora);
  if (candidatos.length === 0) return { abandonados: 0, notificados: 0, fallidos: 0 };

  const abandonados = [];
  for (const candidato of candidatos) {
    try {
      const actualizado = await auditMutation('plan_abandonado', candidato, async session => {
        const resultado = await PlanProgreso.updateOne(filtroPlanSinCambios(candidato), {
          $set: { estado: 'abandonado' },
          $inc: { __v: 1 }
        }, { session });
        if (!resultado.modifiedCount) return null;
        return { ...candidato, _id: candidato.plan_id, estado: 'abandonado', __v: (candidato.__v ?? 0) + 1 };
      }, {
        motivo: 'inactividad', regla: 'abandono_30d_v1',
        evaluado_en: ahora, umbral_hasta: new Date(+ahora - 30 * 86400000)
      });
      if (actualizado) abandonados.push(candidato);
    } catch {
      // Se sigue procesando el lote. El resumen de auditoría conserva el fallo.
    }
  }
  if (!abandonados.length) {
    return { abandonados: 0, notificados: 0, fallidos: 0, total_candidatos: candidatos.length };
  }

  const ids = abandonados.map(c => (c.usuario_id || c._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'plan_abandonado');
  const { enviados, fallidos } = await enviarEnLote(abandonados, {
    tipo_correo: 'plan_abandonado',
    renderFn: (u) => ({ ...planAbandonado(u.nombre), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });

  return {
    abandonados: abandonados.length,
    notificados: enviados,
    fallidos,
    total_candidatos: candidatos.length
  };
}

/**
 * Reinicia (reset parcial) a los planes activos sin actividad por 21+ días y que
 * ya avanzaron más allá del día 1: vuelve al Día 1 con la racha actual en 0 y el
 * progreso diario regenerado. Conserva racha_maxima e hitos_alcanzados y NO toca
 * ultima_fecha_actividad (así el reloj de 30 días del abandono sigue corriendo).
 * Notifica por correo a cada usuario.
 */
async function reiniciarPlanesYNotificar() {
  const ahora = new Date();
  const candidatos = await findPlanesParaReiniciar(ahora);
  if (candidatos.length === 0) return { reiniciados: 0, notificados: 0, fallidos: 0 };

  // AUD-04: solo se notifica a quien efectivamente se le reinició el plan.
  // Antes se enviaba el correo a todos los candidatos, aunque el updateOne no
  // modificara nada (por ejemplo, porque el plan ya había sido abandonado).
  const reiniciadosEfectivos = [];
  const errores = [];
  for (const c of candidatos) {
    try {
      const plan = await archivarYReiniciar(c, 'inactividad', ahora, {}, {
        umbral_hasta: new Date(+ahora - 21 * 86400000),
        umbral_desde: new Date(+ahora - 30 * 86400000)
      });
      if (plan) reiniciadosEfectivos.push(c);
    } catch {
      errores.push(String(c.plan_id));
    }
  }
  const reiniciados = reiniciadosEfectivos.length;
  if (reiniciados === 0) {
    return { reiniciados: 0, notificados: 0, fallidos: 0, errores, total_candidatos: candidatos.length };
  }

  const ids = reiniciadosEfectivos.map(c => (c.usuario_id || c._id).toString());
  const yaEnviados = await yaSeEnviaronBatch(ids, 'plan_reiniciado');
  const { enviados, fallidos } = await enviarEnLote(reiniciadosEfectivos, {
    tipo_correo: 'plan_reiniciado',
    renderFn: (u) => ({ ...planReiniciado(u.nombre, u.dia_actual), meta: { dia_actual: u.dia_actual } }),
    skipFn: (u) => yaEnviados.has((u.usuario_id || u._id).toString())
  });

  return {
    reiniciados,
    notificados: enviados,
    fallidos,
    errores,
    total_candidatos: candidatos.length
  };
}

module.exports = {
  demoledorDeRachas,
  sendReminders: () => auditJob('recordatorios', sendReminders),
  resetStreaksYNotificar,
  enviarActivationNudges: () => auditJob('activacion', enviarActivationNudges),
  enviarRecoveryEmails: () => auditJob('recuperacion', enviarRecoveryEmails),
  abandonarPlanesYNotificar: () => auditJob('abandono', abandonarPlanesYNotificar),
  reiniciarPlanesYNotificar: () => auditJob('reinicio', reiniciarPlanesYNotificar)
};
