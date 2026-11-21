const router = require('express').Router();
const Simulacion = require('../../models/SimulacionAdmin');
const ContenidoDiario = require('../../models/ContenidoDiario');
const ContenidoEspecial = require('../../models/ContenidoEspecial');
const { mapearCamposRespuesta } = require('../../utils/camposRespuesta');
const { tryCatch } = require('../../middlewares/errorHandler');
const AppError = require('../../utils/AppError');

const especiales = { 1: 'presentacion', 15: 'reflexion_15_dias', 30: 'reflexion_30_dias' };

async function vista(sim) {
  const dia = sim.dia_actual;
  const [contenido, especial] = await Promise.all([
    ContenidoDiario.findOne({ dia_numero: dia }).lean(),
    especiales[dia] ? ContenidoEspecial.findOne({ tipo: especiales[dia] }).select('tipo titulo contenido -_id').lean() : null
  ]);
  return {
    simulacion: true,
    dia_actual: dia,
    version: sim.version,
    cabecera: contenido?.cabecera ?? null,
    conclusion: contenido?.conclusion ?? null,
    contenido_especial: especial,
    leccion: contenido ? {
      titulo: contenido.titulo_modulo,
      tipo: contenido.tipo_contenido,
      emociones_objetivo: contenido.emociones_objetivo,
      respuesta_tipo: contenido.respuesta_tipo,
      campos_respuesta: mapearCamposRespuesta(contenido.datos_leccion?.ejercicio?.pasos),
      datos_leccion: contenido.datos_leccion
    } : null
  };
}

router.get('/', tryCatch(async (req, res) => {
  const sim = await Simulacion.findOne({ administrador_id: req.usuario.id }).lean();
  res.json(await vista(sim || { dia_actual: 1, version: 0 }));
}));

router.post('/', tryCatch(async (req, res) => {
  const { accion, version } = req.body || {};
  if (!['avanzar', 'retroceder', 'reiniciar'].includes(accion) || !Number.isInteger(version) || version < 0) {
    throw new AppError(400, 'Acción o versión inválida');
  }
  try {
    await Simulacion.updateOne(
      { administrador_id: req.usuario.id },
      { $setOnInsert: { dia_actual: 1, version: 0 } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const sim = await Simulacion.findOneAndUpdate(
    { administrador_id: req.usuario.id, version },
    [{ $set: {
      dia_actual: accion === 'reiniciar' ? 1 : {
        $min: [30, { $max: [1, { $add: ['$dia_actual', accion === 'avanzar' ? 1 : -1] }] }]
      },
      version: { $add: ['$version', 1] }
    } }],
    { new: true }
  );
  if (!sim) throw new AppError(409, 'La simulación cambió. Actualizá la vista.');
  res.json(await vista(sim));
}));

module.exports = router;
