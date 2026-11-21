const { parseArgs } = require('node:util');
const { mongo } = require('mongoose');
const { asObjectId, collectionName, eventTypes, retentionMs, validator, uuidPattern } = require('../src/modules/auditoria/schema');

const allowedFields = Object.keys(validator.$jsonSchema.properties);

function timestamp(input) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input || '')) throw new Error();
  const date = new Date(input);
  if (date.toISOString() !== input) throw new Error();
  return date;
}

function parseQuery(args) {
  const { values } = parseArgs({
    args, options: {
      usuario: { type: 'string' }, solicitud: { type: 'string' }, job: { type: 'string' },
      desde: { type: 'string' }, hasta: { type: 'string' },
      zona: { type: 'string', default: 'UTC' }, evento: { type: 'string' },
      cursor: { type: 'string' }, json: { type: 'boolean', default: false }
    }
  });
  const usuario = asObjectId(values.usuario);
  const selectors = [values.usuario, values.solicitud, values.job].filter(value => value !== undefined);
  if (selectors.length !== 1 || (values.usuario !== undefined && !usuario) ||
      (values.solicitud !== undefined && !uuidPattern.test(values.solicitud)) ||
      (values.job !== undefined && !uuidPattern.test(values.job))) throw new Error();
  const desde = timestamp(values.desde);
  const hasta = timestamp(values.hasta);
  if (desde >= hasta || hasta - desde > retentionMs ||
      (values.evento && !eventTypes.includes(values.evento))) throw new Error();
  const format = new Intl.DateTimeFormat('es-PY', {
    timeZone: values.zona, dateStyle: 'short', timeStyle: 'medium'
  });
  const filter = {
    ...(usuario && { usuario_id: usuario }),
    ...(values.solicitud && { solicitud_id: values.solicitud }),
    ...(values.job && { job_id: values.job }),
    fecha: { $gte: desde, $lt: hasta }, vence_en: { $gt: new Date() },
    ...(values.evento && { evento: values.evento })
  };
  if (values.cursor) {
    const [fecha, id, extra] = values.cursor.split('/');
    const date = timestamp(fecha);
    if (extra !== undefined || date < desde || date >= hasta ||
        !uuidPattern.test(id || '')) throw new Error();
    filter.$or = [{ fecha: { $gt: date } }, { fecha: date, _id: { $gt: id } }];
  }
  return { filter, format, json: values.json };
}

async function main() {
  let query;
  try {
    query = parseQuery(process.argv.slice(2));
    if (!process.env.AUDIT_READER_URI) throw new Error();
  } catch {
    console.error('Uso: node scripts/auditoria-consultar.js (--usuario ID | --solicitud ID | --job ID) --desde ISO_UTC --hasta ISO_UTC [--zona IANA] [--evento TIPO] [--cursor FECHA/ID] [--json]');
    console.error('Requiere AUDIT_READER_URI y fechas como 2026-11-19T00:00:00.000Z.');
    process.exitCode = 1;
    return;
  }

  const client = new mongo.MongoClient(process.env.AUDIT_READER_URI, { timeoutMS: 5000, readPreference: 'primary' });
  try {
    const projection = Object.fromEntries(allowedFields.map(field => [field, 1]));
    const batch = await client.db().collection(collectionName).find(query.filter, { projection })
      .sort({ fecha: 1, _id: 1 }).limit(101).toArray();
    const events = batch.slice(0, 100);
    const last = events.at(-1);
    const next = batch.length > 100 ? last.fecha.toISOString() + '/' + last._id : null;

    if (query.json) {
      console.log(JSON.stringify({ eventos: events, siguiente_cursor: next }, null, 2));
      return;
    }
    console.table(events.map(e => ({
      fecha: query.format.format(e.fecha), evento: e.evento, resultado: e.resultado,
      dia: e.dia_programa ?? e.perfil_consultado?.dia_actual ?? e.dias?.join(',') ?? '',
      racha_perfil: e.perfil_consultado?.racha_dias ?? '', completado_hoy: e.completado_hoy ?? '',
      motivo: e.motivo ?? '', secuencia: e.anterior && e.posterior
        ? e.anterior.dia_actual + '→' + e.posterior.dia_actual + ' / racha ' + e.anterior.racha_dias + '→' + e.posterior.racha_dias
        : '',
      solicitud: e.solicitud_id ?? '', job: e.job_id ?? '', referencia: e._id
    })));
    if (next) console.log('Siguiente página con --cursor ' + next);
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch(() => {
  console.error('No se pudo consultar la auditoría.');
  process.exitCode = 1;
});
module.exports = { parseQuery };
