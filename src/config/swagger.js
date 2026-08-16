const swaggerJsdoc = require('swagger-jsdoc');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IEN API',
      version: '1.0.0',
      description: 'API del programa IEN (Inteligencia Emocional)'
    },
    servers: [
      { url: BACKEND_URL, description: process.env.NODE_ENV === 'production' ? 'Production' : 'Local' }
    ],
    tags: [
      { name: 'Auth', description: 'Autenticación y registro' },
      { name: 'Plan', description: 'Plan del usuario' },
      { name: 'Admin - Tiendas', description: 'Gestión de sucursales' },
      { name: 'Admin - Productos', description: 'Gestión de productos y alcances' },
      { name: 'Admin - Códigos', description: 'Códigos de activación' },
      { name: 'Admin - Usuarios', description: 'CRUD de administradores y moderadores' },
      { name: 'Admin - Reportes', description: 'Dashboard, métricas y perfiles de pacientes' },
      { name: 'Jobs', description: 'Tareas internas (cron)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido al login/registro'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key para endpoints internos (cron jobs)'
        }
      }
    }
  },
  apis: ['./src/modules/**/*.routes.js']
};

module.exports = swaggerJsdoc(options);
