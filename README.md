# IEN Backend — API de Inteligencia Emocional

API REST para el programa IEN (Inteligencia Emocional) con planes de 30 días, autenticación JWT, panel admin y cron jobs.

## Requerimientos

- **Node.js** >= 18 (usamos `node --watch`)
- **MongoDB** >= 6.0 (local o Atlas)

## Stack

| Herramienta | Uso |
|-------------|-----|
| Express 4 | Framework HTTP |
| Mongoose 8 | ODM para MongoDB |
| bcryptjs | Hash de contraseñas |
| jsonwebtoken | JWT access token (15 min) + refresh token (30 días) |
| express-rate-limit | Rate limiting en endpoints de auth |
| swagger-jsdoc + swagger-ui-express | Documentación interactiva |
| morgan | Logging de requests |
| dotenv | Variables de entorno |
| jest | Testing unitario |

## Instalación

```bash
git clone <repo-url>
cd ien-back
npm install
```

## Configuración

Crear archivo `.env` (usar `.env.example` como referencia):

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/ien
JWT_SECRET=tu_secreto_aqui
CRON_API_KEY=tu_api_key_cron
```

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default 3000) |
| `MONGO_URI` | URI de conexión a MongoDB |
| `JWT_SECRET` | Secreto para firmar tokens JWT |
| `CRON_API_KEY` | API Key para endpoints internos (cron jobs) |

## Auditoría de rachas en Northflank

El backend admite dos modos. El modo transaccional sigue siendo el predeterminado. Para la base de aplicación actual en `admin`, configurar explícitamente `AUDIT_MODE=operativa`. MongoDB excluye `admin` de las transacciones multidocumento.

En modo operativo, completar un día, romper una racha, reiniciar y reactivar un plan guardan el cambio y su evento en una escritura del mismo documento. El backend copia los pendientes a `eventos_auditoria` al arrancar y cada 30 segundos después de terminar la pasada anterior. Comprueba las copias repetidas antes de retirar cada pendiente. Las lecturas, los eventos de sesión, el alta y el abandono de planes se registran por separado y pueden perderse. La consulta es interna y la colección aplica una retención de 180 días mediante TTL. Quien tenga credenciales con permisos amplios puede modificar los registros.

Cada plan admite 16 pendientes. Desde 14 se emite `auditoria_pendientes_altos`. Si se llena, el usuario sigue avanzando, se conservan los pendientes anteriores y se suma una pérdida al contador de límites en `auditoria_perdidas`. Alertar también por `auditoria_copia_pendiente` y por eventos inválidos o distintos (`auditoria_evento_invalido`, `auditoria_copia_no_coincide`). Estos avisos no incluyen identidades ni respuestas. Para determinar si una consulta puede estar incompleta, un operador con acceso privado puede contar los planes pendientes con `db.planes_progreso.countDocuments({"auditoria_pendiente.0._id": {$exists: true}})`.

### Reconstruir una incidencia

Consultar por usuario y rango de fechas con la CLI de auditoría. Un mismo `solicitud_id` vincula el guardado recibido con su confirmación o rechazo. `completado_hoy` indica un segundo envío para el mismo día UTC y `plan_cambio` indica que el plan ya no coincidía al escribir. Un intento sin desenlace visible queda indeterminado. El perfil registra el día, la racha y el estado que calculó el servidor. La lista registra los números de día incluidos en la respuesta; puede incluir varios y no acredita que se haya leído cada uno.

También se registran el alta de cuenta, el cambio de horario de recordatorio, las consultas de bienvenida, preguntas y resultados del test, el envío del test y las solicitudes de avance, retroceso y autocompletado manual. El resultado y el estado HTTP distinguen solicitudes aceptadas y rechazadas. Estas observaciones van directamente al historial con entrega de mejor esfuerzo. Solo se asocian a una cuenta cuando el servidor conoce su identidad. El seguimiento empieza con el despliegue de esta versión.

### Activación y reversión

1. Probar con un replica set descartable y una base de aplicación llamada `admin`. Comprobar en el destino la base real de `MONGO_URI`, la disponibilidad del respaldo, los permisos efectivos de la cuenta de servicio y la versión desplegada para poder volver a ella.
2. Pausar los jobs durante el cambio. En un proceso de mantenimiento, usar `AUDIT_MODE=operativa` y una `AUDIT_MAINTENANCE_URI` que seleccione la misma base de aplicación. Ejecutar `node scripts/auditoria-db.js preparar`. Esto prepara la colección, sus índices, y agrega un índice de pendientes en los planes. Revisar cualquier colección preexistente antes de preparar. El mantenimiento requiere permisos de creación de índices y colección, en esta base. MongoDB rechaza los validadores de colección en admin. El backend verifica el esquema antes de insertar o copiar eventos; los clientes directos de Mongo pueden omitir esa comprobación.
3. Configurar el servicio con `NODE_ENV=production`, `AUDIT_MODE=operativa` y `AUDIT_BUILD_VERSION` con el SHA del build. Mantener las credenciales en secretos. Validar disponibilidad, copia de eventos y ausencia de pérdidas antes de reactivar los jobs. La CLI y los campos consultables están en [la guía interna](AUDITORIA_EVENTOS.md).
4. Ante fallos, pausar los jobs, restaurar la imagen y configuración anterior y conservar datos, pendientes e índices. Registrar el intervalo sin cobertura. Este rollback revierte el software y conserva las actividades confirmadas.
5. Para volver al modo transaccional, confirmar una base de aplicación compatible fuera de `admin` y privilegios restringidos, detener temporalmente las escrituras y mantener el copiador hasta que queden cero pendientes. Verificar datos y probar el cambio antes de activar `AUDIT_MODE=transaccional`. Un cambio de roles por sí solo no habilita transacciones en `admin`.

## Scripts

```bash
npm run dev      # Desarrollo con auto-reload (node --watch)
npm start        # Producción
npm run seed     # Poblar BD con datos iniciales
npm test         # Tests unitarios (Jest)
```

## Seed

El seed crea:

- **3 tiendas**: IEN-001, IEN-002, IEN-003
- **1 admin**: admin@ien.test / admin123
- **30 contenidos diarios** (días 1 al 30)

```bash
npm run seed
```

## Uso básico

### 1. Validar código y registrar usuario

```bash
curl -X POST http://localhost:3000/api/auth/validate-code \
  -H "Content-Type: application/json" \
  -d '{"codigo_activacion": "IEN-001"}'

curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "password": "123456", "nombre": "Test", "codigo_activacion": "IEN-001"}'
```

### 2. Iniciar sesión

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "password": "123456"}'
# → { access_token: "eyJ...", refresh_token: "..." }
```

### 3. Configurar plan y avanzar

```bash
# Setup del plan (usa el código del usuario autenticado)
curl -X POST http://localhost:3000/api/plan/setup-test \
  -H "Authorization: Bearer <token>"

# Ver contenido de hoy
curl http://localhost:3000/api/plan/today \
  -H "Authorization: Bearer <token>"

# Marcar día como completado
curl -X POST http://localhost:3000/api/plan/complete-day \
  -H "Authorization: Bearer <token>"
```

### 4. Admin — Dashboard

```bash
curl http://localhost:3000/api/admin/dashboard/metrics \
  -H "Authorization: Bearer <token_admin>"
```

### 5. Cron jobs (protegidos con API Key)

```bash
curl -X POST http://localhost:3000/api/jobs/reset-streaks \
  -H "X-API-KEY: tu_api_key_cron"

curl -X POST http://localhost:3000/api/jobs/send-reminders \
  -H "X-API-KEY: tu_api_key_cron"
```

## Documentación interactiva

Una vez corriendo el servidor, abrir:

```
http://localhost:3000/api-docs
```

## Estructura del proyecto

```
ien-back/
├── src/
│   ├── app.js                 # Configuración Express
│   ├── server.js              # Conexión MongoDB + listen
│   ├── config/
│   │   └── swagger.js         # Configuración de Swagger
│   ├── controllers/           # Handlers de rutas
│   ├── middlewares/           # auth, admin, apiKey, errorHandler
│   ├── models/                # Schemas de Mongoose
│   ├── routes/                # Definición de rutas Express
│   ├── services/              # Lógica de negocio
│   ├── utils/
│   │   ├── AppError.js        # Clase de error personalizada
│   │   └── fechas.js          # Utilidades de fecha UTC
│   ├── seed.js                # Poblado inicial de BD
│   └── test-flow.js           # Script de prueba del flujo completo
├── tests/                     # Tests unitarios (Jest)
│   ├── fechas.test.js
│   ├── rachas.test.js
│   └── hitos.test.js
└── .env.example
```

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| **Auth** | | | |
| POST | `/api/auth/validate-code` | — | Validar código de activación |
| POST | `/api/auth/register` | — | Registro de usuario |
| POST | `/api/auth/login` | — | Inicio de sesión |
| POST | `/api/auth/refresh` | — | Refrescar access token (rotación completa) |
| POST | `/api/auth/logout` | — | Cerrar sesión (revoca refresh token) |
| **Plan** | | | |
| POST | `/api/plan/setup-test` | JWT | Inicializar plan de 30 días |
| GET | `/api/plan/today` | JWT | Contenido del día actual |
| POST | `/api/plan/complete-day` | JWT | Marcar día como completado |
| **Admin** | | | |
| GET | `/api/admin/dashboard/metrics` | JWT+Admin | Dashboard con métricas por tienda |
| **Jobs** | | | |
| POST | `/api/jobs/reset-streaks` | API Key | Resetear rachas vencidas |
| POST | `/api/jobs/send-reminders` | API Key | Enviar recordatorios |

## Formato de errores

Todos los errores siguen el formato:

```json
{ "error": "mensaje descriptivo" }
```
