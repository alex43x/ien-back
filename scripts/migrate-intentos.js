// Dry-run por defecto. No carga .env ni imprime credenciales/respuestas.
// Requiere MONGO_URI explícita. --apply solo durante una ventana sin escritores.
const mongoose = require('mongoose');
const { createHash } = require('crypto');
const Plan = require('../src/models/PlanProgreso');
async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI requerida');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const apply = process.argv.includes('--apply');
  const duplicates = await Plan.aggregate([{ $match: { estado: 'activo' } }, { $group: { _id: '$usuario_id', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
  if (duplicates.length) throw new Error(`Hay ${duplicates.length} usuarios con activos duplicados; resolver manualmente`);
  let usuario, numero = 0, count = 0;
  for await (const p of Plan.find().sort({ usuario_id: 1, fecha_inicio: 1, _id: 1 }).lean().cursor()) {
    if (String(p.usuario_id) !== usuario) { usuario = String(p.usuario_id); numero = 0; }
    numero++; count++;
    const respuestas = (p.progreso_diario || []).filter(d => d.respuesta_usuario != null).length;
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const conservado = { progreso: p.progreso_diario, test: p.test_inicial, racha: p.racha_dias, maxima: p.racha_maxima, hitos: p.hitos_alcanzados };
    console.log(JSON.stringify({ plan_id: p._id, usuario_id: p.usuario_id, numero_intento: numero, respuestas,
      sha256_contenido: hash(conservado), fecha_anomala: !!p.ultima_fecha_actividad && new Date(p.ultima_fecha_actividad) < new Date(p.fecha_inicio), apply }));
    if (apply && p.numero_intento !== numero) await Plan.updateOne({ _id: p._id, numero_intento: p.numero_intento }, { $set: { numero_intento: numero }, $inc: { __v: 1 } });
    if (apply) {
      const despues = await Plan.findById(p._id).lean();
      if (!despues || hash({ progreso: despues.progreso_diario, test: despues.test_inicial, racha: despues.racha_dias, maxima: despues.racha_maxima, hitos: despues.hitos_alcanzados }) !== hash(conservado)) throw new Error(`Cambió el contenido del plan ${p._id}; detener y revisar`);
    }
  }
  // No se infieren vínculos ni motivos antiguos. No se crean sucesores históricos.
  console.log(JSON.stringify({ documentos: count, apply }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
