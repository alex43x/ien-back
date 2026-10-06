const swaggerJsdoc = require('swagger-jsdoc');

function getSwaggerSpec(baseUrl) {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'IEN API',
        version: '1.0.0',
        description: 'API del programa IEN (Inteligencia Emocional)'
      },
      servers: [
        { url: baseUrl, description: 'API' }
      ],
      tags: [
        { name: 'Auth', description: 'Autenticación y registro' },
        { name: 'Plan', description: 'Plan del usuario' },
        { name: 'Admin - Grupos', description: 'Gestión de grupos de tiendas' },
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

  return swaggerJsdoc(options);
}

module.exports = { getSwaggerSpec };
