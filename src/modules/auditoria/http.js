const { randomUUID } = require('node:crypto');
const { actor, context, observe } = require('./auditoria');

const routes = new Map([
  ['POST /api/auth/login', 'login'],
  ['POST /api/auth/refresh', 'renovacion'],
  ['POST /api/auth/logout', 'logout'],
  ['GET /api/auth/profile', 'perfil_auth'],
  ['GET /api/plan/profile', 'perfil_programa'],
  ['GET /api/plan/today', 'actividad_consultada'],
  ['GET /api/plan/days', 'lista_consultada'],
  ['POST /api/plan/complete-day', 'guardado_rechazado']
]);

function reason(status, event) {
  if (status === 401 || status === 403) return event === 'login' ? 'credenciales_rechazadas' : 'sesion_rechazada';
  if (status === 404) return 'no_encontrado';
  if (status === 409) return 'conflicto';
  if (status === 429) return 'limite';
  if (status >= 500) return 'fallo_interno';
  return 'entrada_invalida';
}

function outcome(status, method) {
  if (status >= 500) return 'error';
  if (status >= 400) return 'rechazado';
  if (status === 304) return 'sin_cambios';
  return method === 'HEAD' ? 'solicitado' : 'confirmado';
}

function captureAudit(req, res, next) {
  const scope = { requestId: randomUUID() };
  req.auditRequestId = scope.requestId;
  const path = req.path.toLowerCase().replace(/\/$/, '');
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  const event = routes.get(method + ' ' + path);
  const planRoute = path.startsWith('/api/plan/');
  if (event || planRoute) {
    res.once('finish', () => {
      const status = res.statusCode;
      if (status < 400 && (!event || event === 'guardado_rechazado')) return;
      if (!event && status !== 401 && status !== 403) return;
      const identity = req.usuario || res.locals.auditUser;
      context.run(scope, () => observe({
        ...actor(identity?.id, identity?.rol),
        plan_id: scope.planId,
        dia_programa: event === 'actividad_consultada' || event === 'guardado_rechazado' ? scope.day : undefined,
        ...(status < 400 && res.locals.auditDetails),
        evento: event || 'solicitud_plan_rechazada',
        resultado: outcome(status, req.method),
        motivo: status >= 400 ? reason(status, event) : undefined,
        estado_http: status
      }));
    });
  }
  context.run(scope, next);
}

module.exports = { captureAudit };
