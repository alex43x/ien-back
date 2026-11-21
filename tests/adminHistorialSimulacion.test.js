const request = require('supertest');
const mongoose = require('mongoose');
const { connect, disconnect, clearAll } = require('./helpers/db');
const { createUsuario, createAdmin, createModerador, generateToken } = require('./helpers/auth');
const app = require('../src/app');
const Tienda = require('../src/models/Tienda');
const Grupo = require('../src/models/Grupo');
const Plan = require('../src/models/PlanProgreso');
const Contenido = require('../src/models/ContenidoDiario');

beforeAll(connect);
afterAll(disconnect);
beforeEach(clearAll);

test('historial muestra únicamente días completados y respeta el alcance de tienda', async () => {
  const grupo = await Grupo.create({ nombre: 'Grupo de prueba' });
  const tienda = await Tienda.create({ nombre_tienda: 'Local', grupo_id: grupo._id, ciudad: 'Asunción' });
  const otra = await Tienda.create({ nombre_tienda: 'Otra', grupo_id: grupo._id, ciudad: 'Asunción' });
  const paciente = await createUsuario({ tienda_id: tienda._id });
  const admin = await createAdmin();
  const moderadorAjeno = await createModerador(otra._id);
  await Contenido.create({ dia_numero: 1, tipo_contenido: 'actividad', titulo_modulo: 'Inicio', datos_leccion: {} });
  await Plan.create({ usuario_id: paciente._id, tienda_id: tienda._id, codigo_utilizado: 'LOC-001',
    historial_reinicios: [{ fecha: new Date(), motivo: 'inactividad', fecha_inicio: new Date('2026-01-01'),
      dia_actual: 3, racha_dias: 2, racha_maxima: 2, progreso_diario: [
        { dia_numero: 1, completado: true, fecha_completado: new Date(), respuesta_usuario: { valor: 'Guardada' } },
        { dia_numero: 2, completado: false }
      ] }] });
  const url = `/api/admin/pacientes/${paciente.id}/planes`;
  const forbidden = await request(app).get(url).set('Authorization', `Bearer ${generateToken(moderadorAjeno)}`);
  expect(forbidden.status).toBe(404);
  const headers = { Authorization: `Bearer ${generateToken(admin)}` };
  const list = await request(app).get(url).set(headers);
  expect(list.status).toBe(200);
  expect(list.body.planes.map(p => p.id)).toEqual(['anterior-0', 'actual']);
  const detail = await request(app).get(`${url}/anterior-0`).set(headers);
  expect(detail.status).toBe(200);
  expect(detail.body.dias).toHaveLength(1);
  expect(detail.body.dias[0].respuesta_usuario.valor).toBe('Guardada');
  expect(detail.body.dias[0].leccion.titulo).toBe('Inicio');
});

test('simulación avanza con versión y no altera planes reales', async () => {
  const admin = await createAdmin();
  const usuario = await createUsuario();
  const plan = await Plan.create({ usuario_id: usuario._id, tienda_id: new mongoose.Types.ObjectId(), codigo_utilizado: 'PRUEBA' });
  const headers = { Authorization: `Bearer ${generateToken(admin)}` };
  const start = await request(app).get('/api/admin/simulacion').set(headers);
  expect(start.body).toMatchObject({ dia_actual: 1, version: 0, simulacion: true });
  const advance = await request(app).post('/api/admin/simulacion').set(headers).send({ accion: 'avanzar', version: 0 });
  expect(advance.body).toMatchObject({ dia_actual: 2, version: 1 });
  expect((await request(app).post('/api/admin/simulacion').set(headers).send({ accion: 'avanzar', version: 0 })).status).toBe(409);
  expect((await Plan.findById(plan._id)).dia_actual).toBe(1);
});
