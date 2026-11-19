const { isDeepStrictEqual } = require('node:util');
const { randomUUID } = require('node:crypto');
const { collectionName, retentionMs, validator, indexes } = require('./schema');

const validation = { validator, validationLevel: 'strict', validationAction: 'error' };

async function provision(db) {
  if (await db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext()) {
    await db.command({ collMod: collectionName, ...validation });
  } else {
    await db.createCollection(collectionName, validation);
  }
  await db.collection(collectionName).createIndexes(indexes);
}

function isAuditResource(resource, dbName) {
  if (resource.anyResource) return true;
  return (resource.db === dbName || resource.db === '') &&
    (resource.collection === collectionName || resource.collection === '');
}

async function verifyStorage(db, client) {
  const topology = await db.admin().command({ hello: 1 });
  if (!topology.logicalSessionTimeoutMinutes || (!topology.setName && topology.msg !== 'isdbgrid')) {
    throw new Error('La auditoría requiere MongoDB con transacciones');
  }

  const [info, permissions] = await Promise.all([
    db.listCollections({ name: collectionName }).next(),
    db.command({ connectionStatus: 1, showPrivileges: true })
  ]);
  const privileges = permissions.authInfo.authenticatedUserPrivileges || [];
  const actions = new Set(privileges
    .filter(grant => isAuditResource(grant.resource, db.databaseName))
    .flatMap(grant => grant.actions));
  if (!actions.has('insert') || [...actions].some(action => !['insert', 'listCollections', 'listIndexes'].includes(action))) {
    throw new Error('La identidad del backend no tiene los permisos restringidos de auditoría');
  }

  if (!info || !isDeepStrictEqual(info.options.validator, validator) ||
      info.options.validationLevel !== 'strict' || info.options.validationAction !== 'error') {
    throw new Error('Falta el validador obligatorio de auditoría');
  }
  const existing = await db.collection(collectionName).indexes();
  if (!indexes.every(index => existing.some(actual =>
    actual.name === index.name && Object.entries(index.key).toString() === Object.entries(actual.key).toString() &&
    actual.expireAfterSeconds === index.expireAfterSeconds && !actual.sparse && !actual.partialFilterExpression
  ))) throw new Error('Faltan índices obligatorios de auditoría');

  // Probar el permiso y la topología sin dejar un evento ficticio persistido.
  await client.withSession(async session => {
    session.startTransaction();
    try {
      const fecha = new Date();
      await db.collection(collectionName).insertOne({
        _id: randomUUID(), fecha, vence_en: new Date(+fecha + retentionMs),
        evento: 'job_inicio', resultado: 'solicitado', actor_tipo: 'job', version_backend: 'verificacion'
      }, { session });
    } finally {
      if (session.inTransaction()) await session.abortTransaction();
    }
  });
}

module.exports = { provision, verifyStorage };
