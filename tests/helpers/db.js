process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CRON_API_KEY = process.env.CRON_API_KEY || 'test-api-key';

const mongoose = require('mongoose');
require('../../src/models/index');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ien_test';

async function connect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

async function clearAll() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, disconnect, clearAll };
