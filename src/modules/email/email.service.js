const { Resend } = require('resend');
const HistorialCorreo = require('../../models/HistorialCorreo');

async function registrarHistorial({ usuario_id, destinatario, tipo_correo, estado, meta }) {
  const datos = { usuario_id, email_destino: destinatario, tipo_correo, estado, meta };
  for (let intento = 1; intento <= 2; intento++) {
    try {
      await HistorialCorreo.create(datos);
      return;
    } catch (err) {
      if (intento === 2) {
        console.error('[CRITICAL] No se pudo registrar HistorialCorreo tras reintento:', err.message, JSON.stringify(datos));
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
}

async function enviarCorreo({ usuario_id, destinatario, asunto, html, tipo_correo, meta = {} }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY no configurada');
    await registrarHistorial({ usuario_id, destinatario, tipo_correo, estado: 'fallido', meta });
    return { success: false, error: 'RESEND_API_KEY no configurada' };
  }
  try {
    if (!process.env.EMAIL_FROM) {
        console.error('[CRITICAL] EMAIL_FROM sin configurar — no se puede enviar correo');
        await registrarHistorial({ usuario_id, destinatario, tipo_correo, estado: 'fallido', meta: { error: 'EMAIL_FROM no configurado' } });
        return { success: false, error: 'EMAIL_FROM no configurado' };
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM;
    const { data, error } = await resend.emails.send({ from, to: destinatario, subject: asunto, html });
    if (error) {
      console.error('[emailService] Error de Resend:', error.message);
      await registrarHistorial({ usuario_id, destinatario, tipo_correo, estado: 'fallido', meta });
      return { success: false, error: error.message };
    }
    await registrarHistorial({ usuario_id, destinatario, tipo_correo, estado: 'enviado', meta });
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error('[emailService] Excepción al enviar:', err.message);
    await registrarHistorial({ usuario_id, destinatario, tipo_correo, estado: 'fallido', meta });
    return { success: false, error: err.message };
  }
}

async function yaSeEnvio(usuario_id, tipo_correo) {
  try {
    const existe = await HistorialCorreo.findOne({ usuario_id, tipo_correo, estado: 'enviado' }).lean();
    return !!existe;
  } catch (err) {
    console.error('[yaSeEnvio] Error consultando HistorialCorreo:', err.message);
    throw err;
  }
}

async function yaSeEnviaronBatch(usuarioIds, tipo_correo, filtrarPorHoy = false) {
  const query = {
    usuario_id: { $in: usuarioIds },
    tipo_correo,
    estado: 'enviado'
  };
  if (filtrarPorHoy) {
    const { getInicioDeDiaDeHoy } = require('../../utils/fechas');
    query.fecha_envio = { $gte: getInicioDeDiaDeHoy() };
  }
  const enviados = await HistorialCorreo.find(query).select('usuario_id').lean();
  return new Set(enviados.map(e => e.usuario_id.toString()));
}

async function enviarEnLote(usuarios, { tipo_correo, renderFn, skipFn }) {
  let enviados = 0, fallidos = 0, saltados = 0;
  for (const u of usuarios) {
    try {
      if (skipFn && await skipFn(u)) { saltados++; continue; }
      const { asunto, html, meta } = renderFn(u);
      const resultado = await enviarCorreo({
        usuario_id: u._id || u.usuario_id,
        destinatario: u.email,
        asunto,
        html,
        tipo_correo,
        meta: meta || {}
      });
      if (resultado.success) {
        enviados++;
      } else {
        fallidos++;
      }
    } catch (err) {
      fallidos++;
    }
  }
  return { enviados, fallidos, saltados, total: usuarios.length };
}

module.exports = { enviarCorreo, yaSeEnvio, yaSeEnviaronBatch, enviarEnLote };
