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
const productoRoutes = require('./modules/productos/producto.routes');
const codigoRoutes = require('./modules/codigos/codigo.routes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.set('trust proxy', 1);

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

  if (!user || !pass) return next();

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

app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin/sucursales', sucursalRoutes);
app.use('/api/admin/productos', productoRoutes);
app.use('/api/admin/codigos', codigoRoutes);
app.use('/api/admin', adminRoutes);

// 404 catch-all (JSON, no HTML de Express)
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

module.exports = app;
