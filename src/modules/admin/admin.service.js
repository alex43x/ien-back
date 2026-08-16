const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Usuario = require('../../models/Usuario');
const Tienda = require('../../models/Tienda');
const PlanProgreso = require('../../models/PlanProgreso');
const TestPregunta = require('../../models/TestPregunta');
const ContenidoDiario = require('../../models/ContenidoDiario');
const AppError = require('../../utils/AppError');
const { getInicioDeDiaDeAyer, getInicioDeDiaDeHoy, getFechaHaceDias, getInicioDeDiaDeAnteayer } = require('../../utils/fechas');
const { enScope } = require('../../utils/scope');
const { mapearCamposRespuesta } = require('../../utils/camposRespuesta');
const { panelAdminPorTienda } = require('./panelAdmin');

exports.panelAdminPorTienda = panelAdminPorTienda;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function filtroTiendas(tiendasPermitidas) {
  const scope = tiendasPermitidas === null ? {} : { _id: { $in: tiendasPermitidas } };
  const activas = await Tienda.find({ ...scope, activo: true }).select('_id').lean();
  return { tienda_id: { $in: activas.map(t => t._id) } };
}

async function obtenerPacienteConScope(usuarioId, tiendasPermitidas) {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }

  const usuario = await Usuario.findById(usuarioId)
    .select('-password_hash')
    .populate('tienda_id', 'nombre_tienda ciudad');

  if (!usuario) throw new AppError(404, 'Paciente no encontrado');

  if (tiendasPermitidas !== null && usuario.tienda_id) {
    if (!enScope(usuario.tienda_id._id, tiendasPermitidas)) throw new AppError(404, 'Paciente no encontrado');
  }

  if (usuario.tienda_id?.activo === false) {
    throw new AppError(404, 'Paciente no encontrado');
  }

  return usuario;
}

// ─── Pacientes ────────────────────────────────────────────────────────────────

exports.getPerfilPaciente = async (usuarioId, tiendasPermitidas) => {
  const usuario = await obtenerPacienteConScope(usuarioId, tiendasPermitidas);
  return {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    fecha_registro: usuario.fecha_registro,
    tienda: usuario.tienda_id ?? null
  };
};

exports.getProgresoPaciente = async (usuarioId, tiendasPermitidas) => {
  await obtenerPacienteConScope(usuarioId, tiendasPermitidas);

  const plan = await PlanProgreso.findOne({ usuario_id: usuarioId })
    .sort({ fecha_inicio: -1 })
    .select('estado dia_actual racha_dias racha_maxima hitos_alcanzados fecha_inicio ultima_fecha_actividad test_inicial progreso_diario')
    .lean();

  if (!plan) throw new AppError(404, 'El paciente no tiene plan de progreso');
  return plan;
};

exports.getTestInicialPaciente = async (usuarioId, tiendasPermitidas) => {
  await obtenerPacienteConScope(usuarioId, tiendasPermitidas);

  const plan = await PlanProgreso.findOne({ usuario_id: usuarioId })
    .sort({ fecha_inicio: -1 })
    .select('test_inicial');

  if (!plan || !plan.test_inicial) {
    throw new AppError(404, 'Test inicial no encontrado');
  }

  const testInicial = plan.test_inicial.toObject();
  const preguntasDb = await TestPregunta.find()
    .select('numero texto competencia_label')
    .lean();
  const preguntasMap = new Map(preguntasDb.map(p => [p.numero, p]));

  testInicial.respuestas = testInicial.respuestas.map(r => {
    const pregunta = preguntasMap.get(r.pregunta_numero);
    return {
      ...r,
      texto: pregunta?.texto || '',
      competencia_label: pregunta?.competencia_label || r.competencia
    };
  });

  return {
    fecha_completado: testInicial.fecha_completado,
    puntuaciones_por_competencia: testInicial.puntuaciones_por_competencia,
    competencias_a_mejorar: testInicial.competencias_a_mejorar,
    respuestas: testInicial.respuestas
  };
};

exports.getActividadesPaciente = async (usuarioId, tiendasPermitidas) => {
  await obtenerPacienteConScope(usuarioId, tiendasPermitidas);

  const plan = await PlanProgreso.findOne({ usuario_id: usuarioId })
    .sort({ fecha_inicio: -1 })
    .select('progreso_diario')
    .lean();

  if (!plan) throw new AppError(404, 'El paciente no tiene plan de progreso');

  const diasCompletados = plan.progreso_diario.filter(d => d.completado);
  if (diasCompletados.length === 0) {
    return { dias: [] };
  }

  const contenidos = await ContenidoDiario
    .find({ dia_numero: { $in: diasCompletados.map(d => d.dia_numero) } })
    .lean();
  const contenidoMap = new Map(contenidos.map(c => [c.dia_numero, c]));

  const dias = plan.progreso_diario.map(d => {
    const resultado = {
      dia_numero: d.dia_numero,
      completado: d.completado,
      fecha_completado: d.fecha_completado,
      respuesta_usuario: d.respuesta_usuario || null,
      cabecera: null,
      contenido_especial: null,
      leccion: null
    };

    if (d.completado) {
      const c = contenidoMap.get(d.dia_numero);
      if (c) {
        const pasos = c.datos_leccion?.ejercicio?.pasos;
        const campos_respuesta = mapearCamposRespuesta(pasos);
        resultado.leccion = {
          titulo: c.titulo_modulo,
          tipo: c.tipo_contenido,
          emociones_objetivo: c.emociones_objetivo,
          respuesta_tipo: c.respuesta_tipo,
          campos_respuesta,
          datos_leccion: c.datos_leccion
        };
      }
    }
    return resultado;
  });

  return { dias };
};

// ─── Reportes ─────────────────────────────────────────────────────────────────

exports.getReporteUsuarios = async (tiendasPermitidas) => {
  const hoy = getInicioDeDiaDeHoy();
  const hace7dias = getFechaHaceDias(7);
  const baseFiltro = await filtroTiendas(tiendasPermitidas);

  const [
    totalRegistrados,
    registradosHoy,
    registradosSemanal,
    planesActivos,
    planesActivosHoy,
    planesActivosSemanal
  ] = await Promise.all([
    Usuario.countDocuments({ ...baseFiltro, rol: 'usuario' }),
    Usuario.countDocuments({ ...baseFiltro, rol: 'usuario', fecha_registro: { $gte: hoy } }),
    Usuario.countDocuments({ ...baseFiltro, rol: 'usuario', fecha_registro: { $gte: hace7dias } }),
    PlanProgreso.countDocuments({ ...baseFiltro, estado: 'activo' }),
    PlanProgreso.countDocuments({ ...baseFiltro, estado: 'activo', ultima_fecha_actividad: { $gte: hoy } }),
    PlanProgreso.countDocuments({ ...baseFiltro, estado: 'activo', ultima_fecha_actividad: { $gte: hace7dias } })
  ]);

  return {
    registrados: {
      total: totalRegistrados,
      hoy: registradosHoy,
      semanal: registradosSemanal
    },
    activos: {
      total: planesActivos,
      hoy: planesActivosHoy,
      semanal: planesActivosSemanal
    }
  };
};

exports.getGraficaSemanal = async (tiendasPermitidas) => {
  const hoy = getInicioDeDiaDeHoy();
  const scopeFiltro = await filtroTiendas(tiendasPermitidas);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const inicio = new Date(hoy.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    return { inicio, fin };
  });

  const resultados = await Promise.all(
    dias.map(async ({ inicio, fin }) => {
      const cantidad = await PlanProgreso.countDocuments({
        ...scopeFiltro,
        ultima_fecha_actividad: { $gte: inicio, $lt: fin }
      });
      const fecha = inicio.toISOString().split('T')[0];
      return { fecha, cantidad };
    })
  );

  return resultados;
};

// ─── Listar Pacientes ─────────────────────────────────────────────────────────

exports.listarPacientes = async (pagina, limite, tiendasPermitidas) => {
  const skip = (pagina - 1) * limite;
  const filtro = { ...(await filtroTiendas(tiendasPermitidas)), rol: 'usuario' };

  const [usuarios, total] = await Promise.all([
    Usuario.find(filtro)
      .populate('tienda_id', 'nombre_tienda ciudad')
      .select('nombre email fecha_registro tienda_id')
      .sort({ fecha_registro: -1 })
      .skip(skip)
      .limit(limite)
      .lean(),
    Usuario.countDocuments(filtro)
  ]);

  const ids = usuarios.map(u => u._id);
  const planes = await PlanProgreso.find({ usuario_id: { $in: ids } })
    .sort({ fecha_inicio: -1 })
    .select('usuario_id estado dia_actual racha_dias ultima_fecha_actividad')
    .lean();

  const planesMap = new Map();
  for (const p of planes) {
    if (!planesMap.has(p.usuario_id.toString())) {
      planesMap.set(p.usuario_id.toString(), p);
    }
  }

  const inicioAnteayer = getInicioDeDiaDeAnteayer();

  return {
    pacientes: usuarios.map(u => {
      const plan = planesMap.get(u._id.toString());
      return {
        id: u._id,
        nombre: u.nombre,
        email: u.email,
        fecha_registro: u.fecha_registro,
        tienda: u.tienda_id ? { id: u.tienda_id._id, nombre: u.tienda_id.nombre_tienda } : null,
        plan: plan
          ? {
              estado: plan.estado,
              dia_actual: plan.dia_actual,
              racha_dias: plan.racha_dias,
              en_riesgo: plan.estado === 'activo'
                && plan.ultima_fecha_actividad
                && plan.ultima_fecha_actividad < inicioAnteayer
            }
          : null
      };
    }),
    total,
    pagina
  };
};

// ─── Crear usuarios ───────────────────────────────────────────────────────────

exports.crearAdminNegocio = async ({ nombre, email, password, tiendas_administradas }) => {
  if (!nombre || !email || !password) {
    throw new AppError(400, 'nombre, email y password son requeridos');
  }

  if (!tiendas_administradas || !Array.isArray(tiendas_administradas) || tiendas_administradas.length === 0) {
    throw new AppError(400, 'Debe asignar al menos una tienda');
  }

  const existe = await Usuario.findOne({ email });
  if (existe) throw new AppError(409, 'El email ya está registrado');

  const tiendasExistentes = await Tienda.find({ _id: { $in: tiendas_administradas }, activo: true }).lean();
  if (tiendasExistentes.length !== tiendas_administradas.length) {
    throw new AppError(400, 'Una o más tiendas no existen');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({
    nombre,
    email,
    password_hash,
    rol: 'admin_negocio',
    tiendas_administradas
  });

  return {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    tiendas_administradas: usuario.tiendas_administradas
  };
};

exports.crearModeradorTienda = async ({ nombre, email, password, tienda_id }, creador) => {
  if (!nombre || !email || !password || !tienda_id) {
    throw new AppError(400, 'nombre, email, password y tienda_id son requeridos');
  }

  if (creador.rol === 'admin_negocio') {
    const estaEnScope = (creador.tiendas_administradas || [])
      .some((t) => t.toString() === tienda_id.toString());
    if (!estaEnScope) {
      throw new AppError(403, 'La tienda no está dentro de tu scope');
    }
  }

  const tiendaExiste = await Tienda.findOne({ _id: tienda_id, activo: true }).lean();
  if (!tiendaExiste) throw new AppError(400, 'La tienda no existe');

  const existe = await Usuario.findOne({ email });
  if (existe) throw new AppError(409, 'El email ya está registrado');

  const password_hash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({
    nombre,
    email,
    password_hash,
    rol: 'moderador_tienda',
    tienda_moderada: tienda_id
  });

  return {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    tienda_moderada: usuario.tienda_moderada
  };
};

// ─── CRUD Admin Negocio ──────────────────────────────────────────────────────

exports.listarAdminsNegocio = async () => {
  return Usuario.find({ rol: 'admin_negocio' })
    .select('nombre email tiendas_administradas fecha_registro')
    .populate('tiendas_administradas', 'nombre_tienda ciudad')
    .sort({ fecha_registro: -1 })
    .lean();
};

exports.getAdminNegocio = async (usuarioId) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }
  const usuario = await Usuario.findOne({ _id: usuarioId, rol: 'admin_negocio' })
    .select('nombre email tiendas_administradas fecha_registro')
    .populate('tiendas_administradas', 'nombre_tienda ciudad')
    .lean();
  if (!usuario) throw new AppError(404, 'Administrador de negocio no encontrado');
  return usuario;
};

exports.actualizarAdminNegocio = async (usuarioId, { nombre, email, tiendas_administradas }) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }

  const usuario = await Usuario.findOne({ _id: usuarioId, rol: 'admin_negocio' });
  if (!usuario) throw new AppError(404, 'Administrador de negocio no encontrado');

  if (email && email !== usuario.email) {
    const existe = await Usuario.findOne({ email });
    if (existe) throw new AppError(409, 'El email ya está registrado');
  }

  if (tiendas_administradas !== undefined) {
    if (!Array.isArray(tiendas_administradas) || tiendas_administradas.length === 0) {
      throw new AppError(400, 'Debe asignar al menos una tienda');
    }
    const tiendasExistentes = await Tienda.find({ _id: { $in: tiendas_administradas }, activo: true }).lean();
    if (tiendasExistentes.length !== tiendas_administradas.length) {
      throw new AppError(400, 'Una o más tiendas no existen');
    }
  }

  const updates = {};
  if (nombre) updates.nombre = nombre;
  if (email) updates.email = email;
  if (tiendas_administradas) updates.tiendas_administradas = tiendas_administradas;

  const actualizado = await Usuario.findByIdAndUpdate(usuarioId, updates, { new: true })
    .select('nombre email tiendas_administradas fecha_registro')
    .populate('tiendas_administradas', 'nombre_tienda ciudad')
    .lean();

  return actualizado;
};

exports.eliminarAdminNegocio = async (usuarioId, adminActualId) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }
  if (usuarioId === adminActualId) {
    throw new AppError(400, 'No podés eliminarte a vos mismo');
  }
  const usuario = await Usuario.findOneAndDelete({ _id: usuarioId, rol: 'admin_negocio' });
  if (!usuario) throw new AppError(404, 'Administrador de negocio no encontrado');
  return { mensaje: 'Administrador eliminado' };
};

// ─── CRUD Moderador Tienda ───────────────────────────────────────────────────

exports.listarModeradoresTienda = async (tiendasPermitidas) => {
  const filtro = tiendasPermitidas === null
    ? { rol: 'moderador_tienda' }
    : { rol: 'moderador_tienda', tienda_moderada: { $in: tiendasPermitidas } };

  return Usuario.find(filtro)
    .select('nombre email tienda_moderada fecha_registro')
    .populate('tienda_moderada', 'nombre_tienda ciudad')
    .sort({ fecha_registro: -1 })
    .lean();
};

exports.getModeradorTienda = async (usuarioId, tiendasPermitidas) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }
  const usuario = await Usuario.findOne({ _id: usuarioId, rol: 'moderador_tienda' })
    .select('nombre email tienda_moderada fecha_registro')
    .populate('tienda_moderada', 'nombre_tienda ciudad')
    .lean();
  if (!usuario) throw new AppError(404, 'Moderador de tienda no encontrado');

  if (tiendasPermitidas !== null && usuario.tienda_moderada) {
    if (!enScope(usuario.tienda_moderada._id, tiendasPermitidas)) throw new AppError(404, 'Moderador de tienda no encontrado');
  }

  return usuario;
};

exports.actualizarModeradorTienda = async (usuarioId, { nombre, email, tienda_id }, tiendasPermitidas) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }

  const usuario = await Usuario.findOne({ _id: usuarioId, rol: 'moderador_tienda' });
  if (!usuario) throw new AppError(404, 'Moderador de tienda no encontrado');

  if (tiendasPermitidas !== null && usuario.tienda_moderada) {
    if (!enScope(usuario.tienda_moderada, tiendasPermitidas)) throw new AppError(404, 'Moderador de tienda no encontrado');
  }

  if (email && email !== usuario.email) {
    const existe = await Usuario.findOne({ email });
    if (existe) throw new AppError(409, 'El email ya está registrado');
  }

  if (tienda_id !== undefined) {
    if (tiendasPermitidas !== null) {
      if (!enScope(tienda_id, tiendasPermitidas)) throw new AppError(403, 'La tienda no está dentro de tu scope');
    }
    const tiendaExiste = await Tienda.findOne({ _id: tienda_id, activo: true }).lean();
    if (!tiendaExiste) throw new AppError(400, 'La tienda no existe');
  }

  const updates = {};
  if (nombre) updates.nombre = nombre;
  if (email) updates.email = email;
  if (tienda_id !== undefined) updates.tienda_moderada = tienda_id;

  const actualizado = await Usuario.findByIdAndUpdate(usuarioId, updates, { new: true })
    .select('nombre email tienda_moderada fecha_registro')
    .populate('tienda_moderada', 'nombre_tienda ciudad')
    .lean();

  return actualizado;
};

exports.eliminarModeradorTienda = async (usuarioId, tiendasPermitidas) => {
  if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
    throw new AppError(400, 'ID de usuario inválido');
  }

  const usuario = await Usuario.findOne({ _id: usuarioId, rol: 'moderador_tienda' });
  if (!usuario) throw new AppError(404, 'Moderador de tienda no encontrado');

  if (tiendasPermitidas !== null && usuario.tienda_moderada) {
    if (!enScope(usuario.tienda_moderada, tiendasPermitidas)) throw new AppError(404, 'Moderador de tienda no encontrado');
  }

  await Usuario.findByIdAndDelete(usuarioId);
  return { mensaje: 'Moderador eliminado' };
};
