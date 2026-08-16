const { bienvenida } = require('./bienvenida');
const { recordatorioDiario } = require('./recordatorioDiario');
const { hito } = require('./hito');
const { rachaRota } = require('./rachaRota');
const { urgenciaActivacion } = require('./urgenciaActivacion');
const { recuperacionInactividad } = require('./recuperacionInactividad');
const { recuperacionContrasena } = require('./recuperacionContrasena');

module.exports = {
  bienvenida,
  recordatorioDiario,
  hito,
  rachaRota,
  urgenciaActivacion,
  recuperacionInactividad,
  recuperacionContrasena,
};
