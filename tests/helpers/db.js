process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CRON_API_KEY = process.env.CRON_API_KEY || 'test-api-key';

const mongoose = require('mongoose');
require('../../src/models/index');

let memoryServer = null;

async function connect() {
  if (mongoose.connection.readyState === 0) {
    let uri = process.env.MONGO_URI;
    if (!uri) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('ien_test');
    }
    await mongoose.connect(uri);
  }
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

async function clearAll() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, disconnect, clearAll };
