const router = require('express').Router();
const mongoose = require('mongoose');
const { tryCatch } = require('../../middlewares/errorHandler');
const AppError = require('../../utils/AppError');
const Contenido = require('../../models/ContenidoDiario');
// Colección independiente: nunca participa de consultas de pacientes ni jobs.
const Simulacion = mongoose.models.Simulacion || mongoose.model('Simulacion', new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  dia_actual: { type: Number, default: 1 }, version: { type: Number, default: 0 }
}), 'simulaciones');

async function vista(sim) {
  const contenido = await Contenido.findOne({ dia_numero: sim.dia_actual }).lean();
  return { dia_actual: sim.dia_actual, version: sim.version,
    leccion: contenido ? { dia_actual: sim.dia_actual, titulo: contenido.titulo_modulo,
      tipo: contenido.tipo_contenido, emociones_objetivo: contenido.emociones_objetivo,
      respuesta_tipo: contenido.respuesta_tipo, datos_leccion: contenido.datos_leccion,
      campos_respuesta: require('../../utils/camposRespuesta').mapearCamposRespuesta(contenido.datos_leccion?.ejercicio?.pasos) } : null,
    simulacion: true };
}
router.get('/', tryCatch(async (req, res) => {
  const sim = await Simulacion.findOne({ usuario_id: req.usuario.id }).lean();
  res.json(await vista(sim || { dia_actual: 1, version: 0 }));
}));
router.post('/', tryCatch(async (req, res) => {
  const { accion, version } = req.body;
  if (!['avanzar', 'retroceder', 'reiniciar'].includes(accion) || !Number.isInteger(version)) throw new AppError(400, 'Acción o versión inválida');
  try { await Simulacion.updateOne({ usuario_id: req.usuario.id }, { $setOnInsert: { dia_actual: 1, version: 0 } }, { upsert: true }); }
  catch (err) { if (err.code !== 11000) throw err; }
  const sim = await Simulacion.findOneAndUpdate({ usuario_id: req.usuario.id, version }, [{ $set: {
    dia_actual: accion === 'reiniciar' ? 1 : { $min: [30, { $max: [1, { $add: ['$dia_actual', accion === 'avanzar' ? 1 : -1] }] }] },
    version: { $add: ['$version', 1] }
  } }], { new: true });
  if (!sim) throw new AppError(409, 'La simulación cambió. Actualizá la vista.');
  res.json(await vista(sim));
}));
module.exports = router;
