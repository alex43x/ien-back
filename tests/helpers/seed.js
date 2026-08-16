const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let counter = 0;

const COMPETENCIAS = [
  { key: 'autoconciencia', label: 'Autoconciencia' },
  { key: 'autoconfianza', label: 'Autoconfianza' },
  { key: 'autocontrol', label: 'Autocontrol' },
  { key: 'empatia', label: 'Empatía' },
  { key: 'motivacion', label: 'Motivación' },
  { key: 'competencia_social', label: 'Competencia Social' }
];

async function seed() {
  counter++;
  const ts = Date.now();
  const uid = `${ts}-${counter}`;

  const Tienda = mongoose.model('Tienda');
  const Producto = mongoose.model('Producto');
  const Codigo = mongoose.model('Codigo');
  const Usuario = mongoose.model('Usuario');
  const TestPregunta = mongoose.model('TestPregunta');
  const ContenidoEspecial = mongoose.model('ContenidoEspecial');
  const ContenidoDiario = mongoose.model('ContenidoDiario');

  const tienda1 = await Tienda.create({ nombre_tienda: `Sucursal Norte ${uid}`, ciudad: 'Bogota' });
  const tienda2 = await Tienda.create({ nombre_tienda: `Sucursal Sur ${uid}`, ciudad: 'Medellin' });

  const producto1 = await Producto.create({ nombre: `Plan Premium ${uid}`, descripcion: 'Plan completo', tienda_id: tienda1._id });
  const producto2 = await Producto.create({ nombre: `Plan Basico ${uid}`, descripcion: 'Plan basico', tienda_id: tienda2._id });

  const codigo1 = await Codigo.create({ codigo: `COD-${uid}-001`, producto_id: producto1._id, tienda_id: tienda1._id, activo: true });
  const codigo2 = await Codigo.create({ codigo: `COD-${uid}-002`, producto_id: producto2._id, tienda_id: tienda2._id, activo: true });

  const preguntas = [];
  let num = 1;
  for (const comp of COMPETENCIAS) {
    preguntas.push({ numero: num, texto: `Pregunta ${num} de ${comp.label}`, competencia: comp.key, competencia_label: comp.label });
    preguntas.push({ numero: num + 1, texto: `Pregunta ${num + 1} de ${comp.label}`, competencia: comp.key, competencia_label: comp.label });
    num += 2;
  }
  await TestPregunta.insertMany(preguntas);

  await ContenidoEspecial.create({ tipo: 'bienvenida', titulo: 'Bienvenido', contenido: { intro: 'test' } });

  for (let d = 1; d <= 30; d++) {
    await ContenidoDiario.create({
      dia_numero: d,
      titulo_modulo: `Dia ${d}`,
      tipo_contenido: 'leccion',
      emociones_objetivo: ['calma'],
      respuesta_tipo: 'escala',
      datos_leccion: { ejercicio: { pasos: [] } }
    });
  }

  const adminGeneral = await Usuario.create({
    nombre: 'Admin General',
    email: `admin-general-${uid}@test.com`,
    password_hash: await bcrypt.hash('admin123', 4),
    rol: 'admin_general',
    fecha_registro: new Date()
  });

  const adminNegocio = await Usuario.create({
    nombre: 'Admin Negocio',
    email: `admin-negocio-${uid}@test.com`,
    password_hash: await bcrypt.hash('admin123', 4),
    rol: 'admin_negocio',
    tiendas_administradas: [tienda1._id],
    fecha_registro: new Date()
  });

  const adminGeneral2 = await Usuario.create({
    nombre: 'Admin Negocio 2',
    email: `admin-negocio2-${uid}@test.com`,
    password_hash: await bcrypt.hash('admin123', 4),
    rol: 'admin_negocio',
    tiendas_administradas: [tienda2._id],
    fecha_registro: new Date()
  });

  const moderador = await Usuario.create({
    nombre: 'Moderador',
    email: `moderador-${uid}@test.com`,
    password_hash: await bcrypt.hash('admin123', 4),
    rol: 'moderador_tienda',
    tienda_moderada: tienda1._id,
    fecha_registro: new Date()
  });

  const usuario = await Usuario.create({
    nombre: 'Paciente Test',
    email: `paciente-${uid}@test.com`,
    password_hash: await bcrypt.hash('user123', 4),
    rol: 'usuario',
    tienda_id: tienda1._id,
    producto_id: producto1._id,
    codigo_activacion: codigo1.codigo,
    fecha_registro: new Date()
  });

  return {
    tiendas: [tienda1, tienda2],
    productos: [producto1, producto2],
    codigos: [codigo1, codigo2],
    adminGeneral,
    adminNegocio,
    adminGeneral2,
    moderador,
    usuario,
    tienda1Id: tienda1._id.toString(),
    tienda2Id: tienda2._id.toString(),
    producto1Id: producto1._id.toString(),
    producto2Id: producto2._id.toString(),
    codigo1: codigo1.codigo,
    codigo2: codigo2.codigo,
    uid,
    totalPreguntas: preguntas.length
  };
}

module.exports = { seed };
