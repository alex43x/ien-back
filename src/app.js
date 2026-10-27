const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const authMiddleware = require('./middlewares/authMiddleware');
const authRoutes = require('./modules/auth/auth.routes');
const planRoutes = require('./modules/plan/plan.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const jobRoutes = require('./modules/jobs/job.routes');
const sucursalRoutes = require('./modules/tiendas/tienda.routes');
const grupoRoutes = require('./modules/grupos/grupo.routes');
const productoRoutes = require('./modules/productos/producto.routes');
const codigoRoutes = require('./modules/codigos/codigo.routes');

const swaggerUi = require('swagger-ui-express');
const { getSwaggerSpec } = require('./config/swagger');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Cadena de proxies: Cliente -> Cloudflare -> ingress Northflank -> Nginx (ien-front) -> ingress -> backend.
// Confiamos en rangos privados (hops internos) y en Cloudflare, para que req.ip sea la IP real del cliente.
// Ref: https://www.cloudflare.com/ips
const TRUSTED_PROXIES = [
  'loopback',
  'linklocal',
  'uniquelocal',
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];
app.set('trust proxy', TRUSTED_PROXIES);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Root route
app.get('/', (_req, res) => {
  res.send('IEN Backend API is running.');
});

// Basic Auth para proteger Swagger en produccion
const swaggerAuth = (req, res, next) => {
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASS;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    return next();
  }

  const auth = (req.headers.authorization || '');
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Swagger Docs"');
    return res.status(401).json({ error: 'Acceso restringido' });
  }
  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (u !== user || p !== pass) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }
  next();
};

app.get('/api-docs/swagger.json', swaggerAuth, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json(getSwaggerSpec(baseUrl));
});

app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/api-docs/swagger.json' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin/sucursales', sucursalRoutes);
app.use('/api/admin/grupos', grupoRoutes);
app.use('/api/admin/productos', productoRoutes);
app.use('/api/admin/codigos', codigoRoutes);
app.use('/api/admin', adminRoutes);

// 404 catch-all (JSON, no HTML de Express)
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

module.exports = app;
