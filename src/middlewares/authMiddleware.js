const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Token requerido'));
  }

  const token = header.split(' ')[1];

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expirado'));
    }
    next(new AppError(401, 'Token inválido'));
  }
}

module.exports = authMiddleware;
