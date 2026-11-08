const { randomUUID } = require('crypto');
const Plan = require('../../models/PlanProgreso');
const Usuario = require('../../models/Usuario');
const { enviarCorreo } = require('../email/email.service');
const { rachaRota, planReiniciado, planAbandonado } = require('../email/templates');

// Outbox embebida: el aviso se guarda en la misma escritura que la transición.
// Una lease evita dos trabajadores simultáneos; la clave se reutiliza al reintentar.
async function procesarAvisos() {
  const result = { enviados: 0, fallidos: 0 };
  const ahora = new Date();
  const tipos = ['racha_rota', 'plan_reiniciado', 'plan_abandonado'];
  if (process.env.PLAN_NOTIFICATIONS_ENABLED === 'false') return { ...result, pausado: true };
  for await (const plan of Plan.find({ eventos: { $elemMatch: { tipo: { $in: tipos }, envio: { $nin: ['enviado', 'omitido'] } } } }).lean().cursor()) {
    for (const evento of plan.eventos || []) {
      if (!tipos.includes(evento.tipo) || ['enviado', 'omitido'].includes(evento.envio)) continue;
      if (evento.lease && new Date(evento.lease) > ahora) continue;
      const claim = randomUUID();
      const locked = await Plan.updateOne({ _id: plan._id, eventos: { $elemMatch: {
        _id: evento._id, envio: { $nin: ['enviado', 'omitido'] },
        $or: [{ lease: { $exists: false } }, { lease: null }, { lease: { $lte: ahora } }]
      } } }, { $set: { 'eventos.$.envio': 'procesando', 'eventos.$.claim': claim,
        'eventos.$.lease': new Date(+ahora + 5 * 60000) }, $inc: { 'eventos.$.intentos': 1 } });
      if (!locked.modifiedCount) continue;
      const usuario = await Usuario.findById(plan.usuario_id).select('nombre email').lean();
      const render = evento.tipo === 'racha_rota' ? rachaRota : evento.tipo === 'plan_reiniciado' ? planReiniciado : planAbandonado;
      let envio;
      try {
        envio = usuario ? await enviarCorreo({ usuario_id: plan.usuario_id, destinatario: usuario.email,
          ...render(usuario.nombre, evento.tipo === 'plan_abandonado' ? undefined : evento.tipo === 'racha_rota' ? evento.meta?.racha_rota : evento.meta?.dia_actual),
          tipo_correo: evento.tipo, meta: { ...evento.meta, plan_id: String(plan._id), evento_id: String(evento._id) },
          idempotencyKey: `plan-event-${evento._id}` }) : { success: false };
      } catch (_) { envio = { success: false }; }
      await Plan.updateOne({ _id: plan._id, eventos: { $elemMatch: { _id: evento._id, claim } } }, {
        $set: { 'eventos.$.envio': envio.success ? 'enviado' : 'fallido', 'eventos.$.lease': null,
          'eventos.$.proveedor_id': envio.messageId || null }
      });
      result[envio.success ? 'enviados' : 'fallidos']++;
    }
  }
  return result;
}
module.exports = { procesarAvisos };
