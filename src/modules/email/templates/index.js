const { bienvenida } = require('./bienvenida');
const { recordatorioDiario } = require('./recordatorioDiario');
const { hito } = require('./hito');
const { rachaRota } = require('./rachaRota');
const { urgenciaActivacion } = require('./urgenciaActivacion');
const { recuperacionInactividad } = require('./recuperacionInactividad');
const { recuperacionContrasena } = require('./recuperacionContrasena');
const { planReiniciado } = require('./planReiniciado');
const { planAbandonado } = require('./planAbandonado');

module.exports = {
  bienvenida,
  recordatorioDiario,
  hito,
  rachaRota,
  urgenciaActivacion,
  recuperacionInactividad,
  recuperacionContrasena,
  planReiniciado,
  planAbandonado,
};
