const { randomUUID } = require('node:crypto');
const { mongo } = require('mongoose');
const { collectionName, retentionMs } = require('../src/modules/auditoria/schema');
const { provision, verifyStorage } = require('../src/modules/auditoria/storage');

jest.setTimeout(25000);

let root;
let writer;
let reader;
const database = 'auditoria_prueba';

beforeAll(async () => {
  const uri = new URL(process.env.MONGO_TEST_URI);
  if (uri.hostname !== '127.0.0.1') throw new Error('Se requiere el replica set de npm test.');
  uri.pathname = '/' + database;
  root = new mongo.MongoClient(uri.toString());
  const db = root.db();
  await provision(db);
  await db.command({
    createRole: 'audit_writer', roles: [], privileges: [
      { resource: { db: database, collection: collectionName }, actions: ['insert', 'listIndexes'] },
      { resource: { db: database, collection: '' }, actions: ['listCollections'] }
    ]
  });
  await db.command({
    createRole: 'audit_reader', roles: [], privileges: [
      { resource: { db: database, collection: collectionName }, actions: ['find'] }
    ]
  });
  async function createClient(user, role) {
    const password = randomUUID();
    await db.command({ createUser: user, pwd: password, roles: [role] });
    const scoped = new URL(uri);
    scoped.username = user;
    scoped.password = password;
    scoped.searchParams.set('authSource', database);
    return new mongo.MongoClient(scoped.toString());
  }
  writer = await createClient('writer', 'audit_writer');
  reader = await createClient('reader', 'audit_reader');
});

afterAll(async () => {
  await Promise.all([writer?.close(), reader?.close(), root?.close()]);
});

test('el backend puede insertar, el lector consultar y ninguno puede alterar la evidencia', async () => {
  await expect(verifyStorage(writer.db(), writer)).resolves.toBeUndefined();
  await expect(verifyStorage(root.db(), root)).rejects.toThrow('permisos restringidos');
  const writable = writer.db().collection(collectionName);
  const readable = reader.db().collection(collectionName);
  expect(await readable.countDocuments()).toBe(0); // La verificación aborta su prueba.
  const fecha = new Date();
  const event = {
    _id: randomUUID(), fecha, vence_en: new Date(+fecha + retentionMs),
    evento: 'job_inicio', resultado: 'solicitado', actor_tipo: 'job', version_backend: 'prueba'
  };
  await writable.insertOne(event);
  expect(await readable.findOne({ _id: event._id })).toMatchObject(event);
  await expect(writable.findOne({})).rejects.toMatchObject({ code: 13 });
  await expect(writable.updateOne({ _id: event._id }, { $set: { resultado: 'error' } })).rejects.toMatchObject({ code: 13 });
  await expect(writable.deleteOne({ _id: event._id })).rejects.toMatchObject({ code: 13 });
  await expect(readable.insertOne({ ...event, _id: randomUUID() })).rejects.toMatchObject({ code: 13 });
  await expect(writable.insertOne({ ...event, _id: randomUUID(), password: 'prohibida' })).rejects.toMatchObject({ code: 121 });
});
