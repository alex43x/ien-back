const crypto = require('crypto');
const AppError = require('../utils/AppError');

function apiKeyMiddleware(req, _res, next) {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.CRON_API_KEY;

  if (!apiKey || !expected) {
    return next(new AppError(401, 'API key requerida o inválida'));
  }

  const keyBuf = Buffer.from(apiKey, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
    return next(new AppError(401, 'API key requerida o inválida'));
  }

  next();
}

module.exports = apiKeyMiddleware;
