process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CRON_API_KEY = process.env.CRON_API_KEY || 'test-api-key';

const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
require('../../src/models/index');

const { provision } = require('../../src/modules/auditoria/storage');
const { collectionName } = require('../../src/modules/auditoria/schema');
const { waitForObservations } = require('../../src/modules/auditoria/auditoria');

async function connect() {
  if (mongoose.connection.readyState !== 0) return;
  const uri = new URL(process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1');
  if (!process.env.MONGO_TEST_URI || uri.hostname !== '127.0.0.1') {
    throw new Error('Ejecutá npm test para iniciar el replica set desechable.');
  }
  await mongoose.connect(uri.toString(), {
    dbName: 'ien_test_' + randomUUID().replaceAll('-', ''), serverSelectionTimeoutMS: 4000
  });
  await provision(mongoose.connection.db);
}

async function disconnect() {
  await waitForObservations();
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
}

async function clearAll() {
  await waitForObservations();
  await mongoose.connection.db.collection(collectionName).deleteMany({});
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
}

module.exports = { connect, disconnect, clearAll };
