require('dotenv').config();
const mongoose = require('mongoose');
require('./models');
const app = require('./app');

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
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}`);
      console.log(`Swagger documentation: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
