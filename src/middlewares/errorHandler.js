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

  // AUD-05: body más grande que express.json({ limit }) → 413 (antes caía en 500)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
  }

  // Resto de errores 4xx de body-parser (encoding/charset no soportado, request
  // abortado, etc.): respetar su status en vez de responder 500.
  if (err.expose && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Solicitud inválida' });
  }

  if (process.env.NODE_ENV !== 'production') console.error(err);
  else console.error('[ErrorHandler]', err.message || 'Error desconocido');
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { tryCatch, errorHandler };
