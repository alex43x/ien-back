/**
 * Formato de log HTTP para producción sin query strings.
 *
 * El formato 'combined' de morgan registra la URL completa y el header Referer.
 * Eso filtraba a los logs tokens de un solo uso:
 *   - GET /api/auth/verify-reset-token?token=...  (en :url)
 *   - Referer: https://<front>/reset-password?token=...  (en :referrer, porque
 *     el front llama a la API desde esa página)
 * Este formato es idéntico a 'combined' pero sin la parte "?..." de ambos.
 */
function sinQuery(valor) {
  if (typeof valor !== 'string') return valor;
  const i = valor.indexOf('?');
  return i === -1 ? valor : valor.slice(0, i);
}

function registrarTokensMorgan(morgan) {
  morgan.token('url-sin-query', (req) => sinQuery(req.originalUrl || req.url));
  morgan.token('referrer-sin-query', (req) => sinQuery(req.headers.referer || req.headers.referrer));
}

const FORMATO_PRODUCCION =
  ':remote-addr - :remote-user [:date[clf]] ":method :url-sin-query HTTP/:http-version" :status :res[content-length] ":referrer-sin-query" ":user-agent"';

module.exports = { sinQuery, registrarTokensMorgan, FORMATO_PRODUCCION };
