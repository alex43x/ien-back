const AppError = require('../utils/AppError');

function tryCatch(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Mongoose CastError (ObjectId inválido en findById, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  // Mongoose ValidationError (campos requeridos, enum, min/max)
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // MongoDB duplicate key (unique index violation)
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Recurso duplicado' });
  }

  // Express body-parser syntax error (JSON malformado)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformado' });
  }

  if (process.env.NODE_ENV !== 'production') console.error(err);
  else console.error('[ErrorHandler]', err.message || 'Error desconocido');
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { tryCatch, errorHandler };
