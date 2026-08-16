const Usuario = require('../../models/Usuario');
const Tienda = require('../../models/Tienda');
const PlanProgreso = require('../../models/PlanProgreso');
const ContenidoDiario = require('../../models/ContenidoDiario');
const TestPregunta = require('../../models/TestPregunta');
const ContenidoEspecial = require('../../models/ContenidoEspecial');
const { enviarCorreo } = require('../email/email.service');
const { hito } = require('../email/templates');

const AppError = require('../../utils/AppError');
const { esMismoDiaCalendarioUTC } = require('../../utils/fechas');
const { mapearCamposRespuesta } = require('../../utils/camposRespuesta');const CONTENIDO_ESPECIAL_POR_DIA = {
  1: 'presentacion',
  15: 'reflexion_15_dias',
  30: 'reflexion_30_dias'
};

// Último día de cada bloque (cierre del bloque).
const DIAS_CIERRE_BLOQUE = [5, 10, 15, 20, 25, 30];

function yaCompletoActividadHoy(plan, ahora) {
  if (!plan.ultima_fecha_actividad) return false;
  if (!esMismoDiaCalendarioUTC(plan.ultima_fecha_actividad, ahora)) return false;

  // Si la última actividad coincide hoy, verificamos si de verdad hay algún día completado hoy.
  // Evita bloquear al usuario el primer día de creación del plan (donde ultima_fecha_actividad se inicializa hoy).
  return plan.progreso_diario.some(dia =>
    dia.completado && esMismoDiaCalendarioUTC(dia.fecha_completado, ahora)
  );
}

// Hitos de racha a notificar al frontend (para badge/celebración).
// Disparan un correo de celebración al alcanzar el hito.
const HITOS_RACHA = [7, 14, 21, 28];

function detectarHito(racha_dias, hitos_alcanzados = []) {
  if (HITOS_RACHA.includes(racha_dias) && !hitos_alcanzados.includes(racha_dias)) {
    return racha_dias;
  }
  return null;
}

function mapContenidoALeccion(contenido) {
  const pasos = contenido.datos_leccion?.ejercicio?.pasos;
  const campos_respuesta = mapearCamposRespuesta(pasos);

  return {
    titulo: contenido.titulo_modulo,
    tipo: contenido.tipo_contenido,
    emociones_objetivo: contenido.emociones_objetivo,
    respuesta_tipo: contenido.respuesta_tipo,
    campos_respuesta,
    datos_leccion: contenido.datos_leccion
  };
}

async function getCabeceraSiEsInicioDeBloque(diaNumero) {
  const contenido = await ContenidoDiario.findOne({ dia_numero: diaNumero }).select('cabecera').lean();
  return contenido?.cabecera || null;
}

async function getConclusionSiEsCierreDeBloque(diaNumero) {
  if (!DIAS_CIERRE_BLOQUE.includes(diaNumero)) return null;
  const contenido = await ContenidoDiario.findOne({ dia_numero: diaNumero }).select('conclusion').lean();
  return contenido?.conclusion || null;
}

/**
 * Marca el dia_actual del plan como completado de forma atomica:
 * - actualiza el elemento correcto de progreso_diario via operador posicional $
 * - incrementa racha_dias y avanza dia_actual con $inc
 * - actualiza racha_maxima con $max (nunca retrocede)
 * - refresca ultima_fecha_actividad
 * Devuelve { plan, hito_alcanzado } donde hito_alcanzado es el hito de racha
 * alcanzado en este completado, o null si no se alcanzó ninguno nuevo.
 */
async function marcarDiaCompletado(planId, respuestaUsuario, skipValidation = false) {
  const plan = await PlanProgreso.findById(planId)
    .select('dia_actual ultima_fecha_actividad progreso_diario estado racha_dias racha_maxima hitos_alcanzados')
    .lean();
  if (!plan) throw new AppError(404, 'Plan no encontrado');

  const ahora = new Date();

  // LIMITACIÓN CONOCIDA: Comparación de día calendario en UTC.
  if (!skipValidation && yaCompletoActividadHoy(plan, ahora)) {
    throw new AppError(409, 'Ya completaste la actividad de hoy');
  }

  // Actualización atómica con pipeline de agregación (MongoDB 4.2+).
  // Stage 1: marca el día via $map/$cond/$mergeObjects, actualiza fechas, incrementa racha/dia.
  // Stage 2: $max de racha_maxima contra $racha_dias (que ya es el valor post-incremento).
  // Todo en una sola operación atómica — no hay ventana entre $inc y $max.
  const planActualizado = await PlanProgreso.findOneAndUpdate(
    {
      _id: planId,
      progreso_diario: {
        $elemMatch: {
          dia_numero: plan.dia_actual,
          completado: false
        }
      }
    },
    [
      {
        $set: {
          progreso_diario: {
            $map: {
              input: '$progreso_diario',
              as: 'dia',
              in: {
                $cond: {
                  if: { $eq: ['$$dia.dia_numero', plan.dia_actual] },
                  then: { $mergeObjects: ['$$dia', { completado: true, fecha_completado: ahora, respuesta_usuario: respuestaUsuario || null }] },
                  else: '$$dia'
                }
              }
            }
          },
          ultima_fecha_actividad: ahora,
          racha_dias: { $add: ['$racha_dias', 1] },
          dia_actual: { $add: ['$dia_actual', 1] }
        }
      },
      {
        $set: {
          racha_maxima: { $max: ['$racha_maxima', '$racha_dias'] }
        }
      }
    ],
    { new: true }
  );

  if (!planActualizado) {
    throw new AppError(409, 'Ya completaste la actividad de hoy');
  }

  // Si ya se superó el día 30, cerramos el plan como completado
  if (planActualizado.dia_actual > 30 && planActualizado.estado === 'activo') {
    planActualizado.estado = 'completado';
    await planActualizado.save();
  }

  const hito_alcanzado = detectarHito(planActualizado.racha_dias, plan.hitos_alcanzados);
  if (hito_alcanzado !== null) {
    await PlanProgreso.updateOne(
      { _id: planId },
      { $addToSet: { hitos_alcanzados: hito_alcanzado } }
    );
  }

  return { plan: planActualizado, hito_alcanzado };
}

/**
 * Crea el plan inicial de un usuario con los resultados del test.
 */
exports.setupTest = async ({ respuestas, usuarioId }) => {
  const usuario = await Usuario.findById(usuarioId).select('tienda_id codigo_activacion');
  if (!usuario || !usuario.tienda_id) {
    throw new AppError(400, 'Usuario sin tienda asociada — no se puede iniciar el plan');
  }

  const tienda = await Tienda.findById(usuario.tienda_id);
  if (!tienda) {
    throw new AppError(404, 'Tienda no encontrada');
  }
  if (tienda.activo === false) {
    throw new AppError(403, 'No es posible iniciar el plan: la tienda asociada ya no está activa');
  }

  const existe = await PlanProgreso.findOne({ usuario_id: usuarioId });
  if (existe) {
    throw new AppError(409, 'El usuario ya tiene un plan');
  }

  const totalPreguntas = await TestPregunta.countDocuments();
  if (!respuestas || !Array.isArray(respuestas)) {
    throw new AppError(400, 'Formato de respuestas inválido');
  }
  if (respuestas.length !== totalPreguntas) {
    throw new AppError(400, `Se requieren exactamente ${totalPreguntas} respuestas`);
  }

  const preguntasDb = await TestPregunta.find().lean();
  const preguntasMap = new Map(preguntasDb.map(p => [p.numero, p]));

  const numerosVistos = new Set();
  const respuestasProcesadas = [];

  for (const r of respuestas) {
    const num = r.numero;
    const score = r.score;

    if (num === undefined || score === undefined) {
      throw new AppError(400, 'Cada respuesta debe contener numero y score');
    }
    if (numerosVistos.has(num)) {
      throw new AppError(400, `Número de pregunta duplicado: ${num}`);
    }
    numerosVistos.add(num);

    const pregInfo = preguntasMap.get(num);
    if (!pregInfo) {
      throw new AppError(400, `La pregunta con número ${num} no existe en la base de datos`);
    }

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new AppError(400, `El score para la pregunta ${num} debe ser un entero entre 1 y 5`);
    }

    respuestasProcesadas.push({
      pregunta_numero: num,
      competencia: pregInfo.competencia,
      score: score
    });
  }

  if (numerosVistos.size !== totalPreguntas) {
    throw new AppError(400, 'Faltan preguntas por responder o hay números inválidos');
  }

  // Agrupamiento y cálculo del resultado server-side
  const sumasPorCompetencia = {};
  const competenciaLabelsMap = {};
  
  for (const p of preguntasDb) {
    sumasPorCompetencia[p.competencia] = 0;
    competenciaLabelsMap[p.competencia] = p.competencia_label;
  }

  for (const rp of respuestasProcesadas) {
    sumasPorCompetencia[rp.competencia] += rp.score;
  }

  const puntuaciones_por_competencia = [];
  const competencias_a_mejorar = [];

  for (const comp in sumasPorCompetencia) {
    const puntuacion = sumasPorCompetencia[comp];
    const label = competenciaLabelsMap[comp];
    puntuaciones_por_competencia.push({
      competencia: comp,
      competencia_label: label,
      puntuacion: puntuacion
    });
    if (puntuacion < 20) {
      competencias_a_mejorar.push(label);
    }
  }

  const nuevoPlan = await PlanProgreso.create({
    usuario_id: usuarioId,
    tienda_id: tienda._id,
    codigo_utilizado: usuario.codigo_activacion,
    test_inicial: {
      fecha_completado: new Date(),
      respuestas: respuestasProcesadas,
      puntuaciones_por_competencia,
      competencias_a_mejorar
    }
  });

  return nuevoPlan;
};

/**
 * Devuelve los resultados del test inicial del usuario, incluyendo
 * respuestas individuales enriquecidas con el texto de cada pregunta.
 */
exports.getTestInicial = async (usuarioId) => {
  const plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId })
    .select('test_inicial');
  if (!plan || !plan.test_inicial) {
    throw new AppError(404, 'Test inicial no encontrado');
  }

  const preguntasDb = await TestPregunta.find()
    .select('numero texto competencia competencia_label')
    .lean();
  const preguntasMap = new Map(preguntasDb.map(p => [p.numero, p]));

  const respuestasConTexto = plan.test_inicial.respuestas.map(r => {
    const pregunta = preguntasMap.get(r.pregunta_numero);
    return {
      pregunta_numero: r.pregunta_numero,
      competencia: r.competencia,
      score: r.score,
      texto: pregunta?.texto || '',
      competencia_label: pregunta?.competencia_label || r.competencia
    };
  });

  return {
    fecha_completado: plan.test_inicial.fecha_completado,
    puntuaciones_por_competencia: plan.test_inicial.puntuaciones_por_competencia,
    competencias_a_mejorar: plan.test_inicial.competencias_a_mejorar,
    respuestas: respuestasConTexto
  };
};

/**
 * Devuelve el contenido del dia actual del plan activo del usuario.
 */
exports.getToday = async (usuarioId) => {
  let plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: 'activo' })
    .select('dia_actual ultima_fecha_actividad progreso_diario')
    .lean();
  if (!plan) {
    plan = await PlanProgreso
      .findOne({ usuario_id: usuarioId, estado: 'completado' })
      .select('dia_actual ultima_fecha_actividad progreso_diario')
      .lean();
    if (plan) {
      return {
        dia_actual: plan.dia_actual,
        completado: true,
        cabecera: null,
        contenido_especial: null,
        leccion: null
      };
    }
    throw new AppError(404, 'No hay un plan activo');
  }

  const ahora = new Date();
  if (yaCompletoActividadHoy(plan, ahora)) {
    return {
      dia_actual: plan.dia_actual,
      cabecera: null,
      contenido_especial: null,
      leccion: null
    };
  }

  const contenido = await ContenidoDiario.findOne({ dia_numero: plan.dia_actual }).lean();
  if (!contenido) {
    throw new AppError(404, 'Contenido no disponible para este día');
  }

  const tipoEspecial = CONTENIDO_ESPECIAL_POR_DIA[plan.dia_actual];
  const contenidoEspecial = tipoEspecial
    ? await ContenidoEspecial.findOne({ tipo: tipoEspecial }).select('tipo titulo contenido -_id').lean()
    : null;

  return {
    dia_actual: plan.dia_actual,
    cabecera: await getCabeceraSiEsInicioDeBloque(plan.dia_actual),
    contenido_especial: contenidoEspecial,
    leccion: mapContenidoALeccion(contenido)
  };
};

/**
 * Devuelve el estado completo del progreso del plan activo del usuario.
 */
exports.getProfile = async (usuarioId) => {
  let plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: 'activo' })
    .select('dia_actual racha_dias racha_maxima estado fecha_inicio ultima_fecha_actividad progreso_diario')
    .lean();
  if (!plan) {
    plan = await PlanProgreso
      .findOne({ usuario_id: usuarioId, estado: 'completado' })
      .select('dia_actual racha_dias racha_maxima estado fecha_inicio ultima_fecha_actividad progreso_diario')
      .lean();
  }
  if (!plan) {
    throw new AppError(404, 'No hay un plan activo');
  }

  return {
    dia_actual: plan.dia_actual,
    racha_dias: plan.racha_dias,
    racha_maxima: plan.racha_maxima,
    estado: plan.estado,
    actividad_completada_hoy: yaCompletoActividadHoy(plan, new Date()),
    fecha_inicio: plan.fecha_inicio,
    dias_completados: plan.progreso_diario.filter(d => d.completado).length,
    dias_totales: 30
  };
};

/**
 * Completa el día actual y avanza el plan.
 */
exports.completeDay = async (usuarioId, respuestaUsuario) => {
  const plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: 'activo' })
    .select('_id tienda_id')
    .populate('tienda_id', 'nombre_tienda')
    .lean();
  if (!plan) {
    throw new AppError(404, 'No hay un plan activo');
  }

  const { plan: planActualizado, hito_alcanzado } = await marcarDiaCompletado(plan._id, respuestaUsuario);

  if (hito_alcanzado !== null) {
    Usuario.findById(usuarioId).select('nombre email').lean()
      .then(usuario => {
        if (!usuario) return;
        const { asunto, html } = hito(usuario.nombre, hito_alcanzado, plan.tienda_id?.nombre_tienda);
        return enviarCorreo({
          usuario_id: usuarioId,
          destinatario: usuario.email,
          asunto,
          html,
          tipo_correo: 'hito',
          meta: { hito: hito_alcanzado }
        });
      })
      .catch(err => console.error('[completeDay] Error en correo de hito:', err.message));
  }

  return {
    // BUG-01 Fix: Usar el valor incrementado (planActualizado) y restarle 1,
    // garantizando que devolvemos el día exacto que el usuario acaba de completar
    // sin basarnos en la variable 'plan' anterior que está en estado stale.
    dia_completado: planActualizado.dia_actual - 1,
    dia_actual: planActualizado.dia_actual,
    conclusion: await getConclusionSiEsCierreDeBloque(planActualizado.dia_actual - 1),
    racha_dias: planActualizado.racha_dias,
    racha_maxima: planActualizado.racha_maxima,
    estado: planActualizado.estado,
    hito_alcanzado
  };
};

/**
 * Avanza al siguiente día sin validar actividad completada hoy (dev-only).
 */
exports.advanceDay = async (usuarioId) => {
  const plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: 'activo' })
    .select('_id')
    .lean();
  if (!plan) throw new AppError(404, 'No hay un plan activo');

  const { plan: planActualizado, hito_alcanzado } = await marcarDiaCompletado(plan._id, undefined, true);

  await PlanProgreso.updateOne(
    { _id: plan._id },
    { $set: { ultima_fecha_actividad: new Date(0) } }
  );

  return {
    dia_completado: planActualizado.dia_actual - 1,
    dia_actual: planActualizado.dia_actual,
    conclusion: await getConclusionSiEsCierreDeBloque(planActualizado.dia_actual - 1),
    racha_dias: planActualizado.racha_dias,
    racha_maxima: planActualizado.racha_maxima,
    estado: planActualizado.estado,
    hito_alcanzado
  };
};

/**
 * Retrocede al día anterior deshaciendo el último día completado.
 */
exports.retreatDay = async (usuarioId) => {
  const plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: { $in: ['activo', 'completado'] } })
    .select('_id dia_actual racha_dias racha_maxima progreso_diario hitos_alcanzados estado')
    .lean();
  if (!plan) throw new AppError(404, 'No hay un plan activo');

  const completados = plan.progreso_diario
    .filter(d => d.completado)
    .sort((a, b) => b.dia_numero - a.dia_numero);

  if (completados.length === 0) {
    throw new AppError(409, 'No hay días completados para retroceder');
  }

  const ultimo = completados[0];
  const anterior = completados[1] || null;

  const planActualizado = await PlanProgreso.findOneAndUpdate(
    {
      _id: plan._id,
      progreso_diario: {
        $elemMatch: { dia_numero: ultimo.dia_numero, completado: true }
      }
    },
    [{
      $set: {
        progreso_diario: {
          $map: {
            input: '$progreso_diario',
            as: 'dia',
            in: {
              $cond: {
                if: { $eq: ['$$dia.dia_numero', ultimo.dia_numero] },
                then: {
                  $mergeObjects: ['$$dia', {
                    completado: false,
                    fecha_completado: null,
                    respuesta_usuario: null
                  }]
                },
                else: '$$dia'
              }
            }
          }
        },
        ultima_fecha_actividad: new Date(0),
        dia_actual: { $max: [{ $subtract: ['$dia_actual', 1] }, 1] },
        racha_dias: { $max: [{ $subtract: ['$racha_dias', 1] }, 0] },
        estado: {
          $cond: {
            if: { $eq: ['$estado', 'completado'] },
            then: 'activo',
            else: '$estado'
          }
        }
      }
    }],
    { new: true }
  );

  if (!planActualizado) {
    throw new AppError(409, 'No se pudo retroceder el día');
  }

  // Remove hito milestone if current racha was a milestone
  if ([7, 14, 21, 28].includes(plan.racha_dias)) {
    await PlanProgreso.updateOne(
      { _id: plan._id },
      { $pull: { hitos_alcanzados: plan.racha_dias } }
    );
  }

  return {
    dia_retrocedido: ultimo.dia_numero,
    dia_actual: planActualizado.dia_actual,
    racha_dias: planActualizado.racha_dias,
    racha_maxima: planActualizado.racha_maxima,
    estado: planActualizado.estado
  };
};

/**
 * Devuelve los días del plan con su contenido y respuesta del usuario.
 * @param {boolean} soloCompletados - Si true, solo devuelve días completados.
 */
exports.getDays = async (usuarioId, soloCompletados = false) => {
  let plan = await PlanProgreso
    .findOne({ usuario_id: usuarioId, estado: 'activo' })
    .select('progreso_diario');
  if (!plan) {
    plan = await PlanProgreso
      .findOne({ usuario_id: usuarioId, estado: 'completado' })
      .select('progreso_diario');
  }
  if (!plan) throw new AppError(404, 'No hay un plan activo');

  let dias = plan.progreso_diario;
  if (soloCompletados) dias = dias.filter(d => d.completado);
  if (dias.length === 0) return { dias: [] };

  const contenidos = await ContenidoDiario
    .find({ dia_numero: { $in: dias.map(d => d.dia_numero) } })
    .lean();
  const contenidoMap = new Map(contenidos.map(c => [c.dia_numero, c]));

  const tiposNecesarios = Object.values(CONTENIDO_ESPECIAL_POR_DIA);
  const especiales = await ContenidoEspecial.find({ tipo: { $in: tiposNecesarios } }).select('tipo titulo contenido -_id').lean();
  // NOTA: Asumimos 1 doc por tipo (garantizado por seed + enum).
  // Si se carga contenido especial manualmente con tipos duplicados,
  // el Map se queda con el último. No rompe pero puede ser confuso.
  const especialesPorTipo = new Map(especiales.map(e => [e.tipo, e]));

  const diasMapeados = dias.map(d => ({
    dia_numero: d.dia_numero,
    completado: d.completado,
    fecha_completado: d.fecha_completado,
    respuesta_usuario: d.respuesta_usuario || null,
    cabecera: contenidoMap.get(d.dia_numero)?.cabecera ?? null,
    contenido_especial: (() => {
      const tipo = CONTENIDO_ESPECIAL_POR_DIA[d.dia_numero];
      if (!tipo || d.completado) return null;
      return especialesPorTipo.get(tipo) || null;
    })(),
    leccion: (() => {
      const c = contenidoMap.get(d.dia_numero);
      if (!c) return null;
      return mapContenidoALeccion(c);
    })()
  }));

  return { dias: diasMapeados };
};

/**
 * Devuelve todas las preguntas de test ordenadas por número.
 */
exports.getTestPreguntas = async () => {
  return TestPregunta.find().sort('numero').select('numero texto competencia competencia_label -_id');
};

// ---------------------------------------------------------------------------
// Dev-only: autocomplete del test inicial
// ---------------------------------------------------------------------------
const COMPETENCIAS_VALIDAS = [
  'autoconciencia', 'autoconfianza', 'autocontrol',
  'empatia', 'motivacion', 'competencia_social'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Autocompleta el test inicial con scores aleatorios.
 * @param {string} usuarioId
 * @param {string[]} debiles - competencias con score bajo (1-2)
 */
exports.autocompleteTest = async (usuarioId, debiles = []) => {
  const invalidos = debiles.filter(d => !COMPETENCIAS_VALIDAS.includes(d));
  if (invalidos.length > 0) {
    throw new AppError(400,
      `Competencia(s) inválida(s): ${invalidos.join(', ')}. Válidas: ${COMPETENCIAS_VALIDAS.join(', ')}`
    );
  }

  const preguntas = await TestPregunta.find().select('numero competencia').lean();

  const respuestas = preguntas.map(p => ({
    numero: p.numero,
    score: debiles.includes(p.competencia) ? randomInt(1, 2) : randomInt(1, 5)
  }));

  return exports.setupTest({ respuestas, usuarioId });
};

exports.getBienvenida = async () => {
  const doc = await ContenidoEspecial.findOne({ tipo: 'bienvenida' }).select('tipo titulo contenido -_id').lean();
  if (!doc) {
    throw new AppError(404, 'Contenido de bienvenida no encontrado');
  }
  return doc;
};

// Exportado para testing unitario
exports.yaCompletoActividadHoy = yaCompletoActividadHoy;
exports.detectarHito = detectarHito;
