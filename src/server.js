require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
require('./models');
const app = require('./app');
const { verifyStorage } = require('./modules/auditoria/storage');

const { PORT = 3000, MONGO_URI } = process.env;

process.on('unhandledRejection', (err) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled Rejection:', err);
  } else {
    console.error('Unhandled Rejection:', err.message);
  }
});

if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    if (process.env.NODE_ENV === 'production') {
      if (!/^[a-zA-Z0-9._-]{1,64}$/.test(process.env.AUDIT_BUILD_VERSION || '')) {
        throw new Error('Falta la versión de despliegue para auditoría');
      }
      await verifyStorage(mongoose.connection.db, mongoose.connection.getClient());
    }
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}`);
      console.log(`Swagger documentation: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api-docs`);
    });
  })
  .catch((err) => {
    if (process.env.NODE_ENV === 'production') console.error('No se pudo verificar MongoDB o la configuración de auditoría.');
    else console.error('MongoDB connection error:', err);
    process.exit(1);
  });
