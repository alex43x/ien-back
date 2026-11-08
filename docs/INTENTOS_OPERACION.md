# Intentos, rachas y conservación de respuestas

Implementación local del 7/11/2026. No se ejecutó migración ni despliegue en producción.

## Comportamiento

- Se mantiene UTC: ruptura de racha antes del inicio de ayer, reinicio a los siete días transcurridos si el día actual es mayor a uno, abandono a los treinta días transcurridos. La prioridad es abandono, reinicio, ruptura.
- Reiniciar o abandonar cierra el documento original sin vaciar respuestas, test, rachas ni hitos. Se reserva un ID de sucesor en esa misma escritura. El sucesor está pendiente, con progreso propio vacío y sin última actividad.
- El usuario activa expresamente el sucesor. Su fecha de inicio pasa a ser el momento de activación. Antes de activarlo, `fecha_inicio` representa la creación del pendiente. Los pendientes no participan del mantenimiento.
- El test inicial se copia como referencia, conservando `test_inicial_origen_id`. No representa un nuevo test contestado.
- La unicidad de activos continúa siendo por usuario, dado que actualmente hay un programa. Un índice único parcial sobre `intento_anterior_id` protege el sucesor. `numero_intento` es la numeración de presentación: el ID y el vínculo anterior identifican el intento; no se usa el número como clave de concurrencia.
- Los GET no reactivan ni limpian datos. Un cerrado anterior al cambio puede continuarse mediante POST, sin inventar un motivo histórico.
- Fechas ausentes, futuras o anteriores al inicio se cuentan como anomalías y no disparan cierres. No se corrigen automáticamente.

## Concurrencia y recuperación

El cierre, su evento y la reserva del sucesor se escriben atómicamente en el documento del intento. La condición compara estado, día, actividad y `__v`. El completado usa la misma protección; los hitos y el cierre al terminar el día 30 se guardan en la misma operación.

Si cambia la versión, la transición no se fuerza: se registra un conflicto y se vuelve a evaluar en la siguiente corrida. El cliente recibe 409 ante un formulario desactualizado. Todos los envíos requieren el `plan_id` y `dia_actual` que se mostraron al abrir la actividad. Los borradores nuevos se separan por usuario, intento y día; los borradores antiguos no se asignan automáticamente a un intento nuevo.

No se requieren transacciones entre colecciones. Si el proceso termina después del cierre pero antes del upsert del sucesor, la siguiente evaluación reconcilia el ID reservado. También lo reconcilia la continuación explícita del usuario.

Los nuevos completados guardan un snapshot de la consigna. Los documentos antiguos conservan lo que ya tenían; no se reconstruye artificialmente una consigna histórica.

## API y permisos

- `POST /api/plan/intentos/continuar`: continúa el último intento cerrado o activa el pendiente. Un programa completado no se reinicia por esta vía.
- `POST /api/plan/intentos/:planId/activar`: propietario, tienda vigente, pendiente. Repetir la activación del mismo activo no crea otro intento.
- `POST /api/plan/complete-day`: requiere `{ plan_id, dia_actual, respuesta_usuario }`. Frontend y backend deben publicarse coordinados. Clientes antiguos deben actualizar la página; no se acepta un envío sin contexto.
- `GET /api/admin/pacientes/:usuarioId/intentos?page=1`: veinte intentos por página.
- `GET /api/admin/pacientes/:usuarioId/intentos/:planId`: detalle de solo lectura, respuestas, test y eventos. Se verifica propietario y alcance de tienda. Mantiene los roles de atención a pacientes: administrador general y de negocio.
- `GET/POST /api/admin/simulacion`: administrador general, de negocio y administrador de local (`moderador_tienda`). El POST recibe `{ accion: 'avanzar' | 'retroceder' | 'reiniciar', version }`.
- Los endpoints antiguos de avance y retroceso responden 410 a administradores, 403 a usuarios comunes. No modifican planes reales.
- `run-daily` responde `{ mantenimiento, nudges, recovery }`; actualizar consumidores que esperaban las antiguas claves separadas.

La simulación usa la colección `simulaciones`, sin suplantar pacientes ni escribir en planes, correos o métricas. Reutiliza la pantalla de lectura y ejercicios. Las respuestas de prueba son temporales en pantalla: avanzar o retroceder no las conserva. No simula el test inicial ni el calendario real.

## Avisos y observabilidad

Los avisos de ruptura, reinicio y abandono nacen del evento guardado junto con la transición aplicada. El worker reclama cada evento con una lease de cinco minutos y una clave estable de idempotencia para el proveedor. Se registran intentos, resultado e ID del proveedor. Los fallidos y leases vencidas se reintentan.

La idempotencia externa depende de las garantías y del período de retención del proveedor. No se promete entrega exactamente una vez ante un fallo posterior al envío y anterior a la confirmación local. Los avisos pendientes se renderizan con la plantilla vigente y el destinatario actual. Revisar entregas inciertas antes de repetirlas tras una interrupción prolongada.

Esta outbox cubre los tres avisos de mantenimiento. Recordatorios, recuperación y correos de hitos mantienen su mecanismo previo; ahora incluyen el ID del plan cuando corresponde. Ejecutar `run-daily` como entrada ordinaria evita las tres decisiones competidoras. Las rutas individuales comparten el mismo evaluador y respetan su prioridad.

Observar `evaluados`, `aplicados`, `conflictos`, `anomalias`, `enviados` y `fallidos` en la respuesta del job. Los eventos contienen corrida, versión anterior, fecha y límites usados. No registrar respuestas ni credenciales en logs.

Interruptores de operación (requieren reinicio del servicio al cambiar variables):

- `PLAN_TRANSITIONS_ENABLED=false`: suspende nuevas transiciones y la reconciliación automática del job. No afecta la lectura ni el completado.
- `PLAN_NOTIFICATIONS_ENABLED=false`: suspende el worker de avisos de mantenimiento. No suspende otros tipos de correo.

## Migración y publicación manual

1. Preparar backup y ventana de mantenimiento. Suspender jobs y escrituras de usuarios; no ejecutar simultáneamente backend antiguo y nuevo.
2. Ensayar primero sobre una copia aislada. El script no carga `.env`: necesita `MONGO_URI` explícita apuntando a esa copia.
3. Ejecutar `node scripts/migrate-intentos.js` para dry-run. No crea índices ni escribe documentos. Informa número propuesto, cantidad de respuestas y hash SHA-256 del contenido conservado. Si hay varios activos del mismo usuario, aborta; no elimina duplicados.
4. Revisar anomalías y duplicados manualmente. El script no reconstruye respuestas perdidas ni relaciones históricas.
5. Con escritores detenidos, ejecutar `node scripts/migrate-intentos.js --apply`. Solo numera intentos e incrementa versión. Verifica por documento que progreso, test, rachas e hitos siguen iguales. Repetir es idempotente.
6. Crear/verificar los índices declarados en `PlanProgreso` usando `PlanProgreso.createIndexes()` con una conexión administrativa controlada, antes de habilitar escritores. No usar `syncIndexes()` ni borrar índices existentes. Verificar también el índice único `usuario_id` de `Simulacion` antes de habilitar esa función. La creación automática de índices del entorno puede hacerlo, pero debe verificarse y no darse por supuesta.
7. Publicar juntos backend y frontend compatibles con `plan_id` y `dia_actual`. Mantener ambos interruptores en `false` durante las comprobaciones iniciales.
8. Probar un usuario de prueba: completado, formulario viejo rechazado, cierre conservando respuesta, activación única, historial administrativo y simulación con moderador de local.
9. Habilitar transiciones y luego avisos; revisar los contadores y los eventos. Confirmar la configuración real de los jobs de Northflank antes de reanudarlos.

Para revertir operativamente, detener jobs y usar los interruptores. Conservar los intentos creados y los índices. No volver a una versión que borre respuestas o asuma un solo documento por usuario. No restaurar toda la base sobre producción para revertir código.

La recuperación del incidente sigue siendo un trabajo independiente: comparar backups en un entorno aislado y aprobar las correcciones de datos concretas antes de aplicarlas.

## Validación local

- Suite completa de backend: 217 pruebas aprobadas en MongoDB temporal local. Después de los últimos ajustes de snapshots, migración e hitos atómicos, se volvieron a ejecutar las tres suites afectadas: 49 pruebas aprobadas.
- Cobertura añadida: límites UTC, concurrencia de jobs, conservación de respuestas, reconciliación, activación idempotente, tienda inactiva, GET sin escritura, alcance administrativo, completado concurrente, respuesta literal, formularios desactualizados, reclamación/reintento de avisos, aislamiento de simulación y migración dry-run/apply idempotente.
- Frontend: 13 pruebas aprobadas, comprobación de tipos y build. Las pruebas nuevas cubren selección del historial, separación de borradores y endpoint de simulación. Una primera corrida tuvo un fallo intermitente en la prueba existente de paginación de pacientes; la siguiente suite completa pasó sin modificar esa prueba.
- No se ejecutó una prueba visual de extremo a extremo en un navegador ni una entrega real de correo. El ensayo de publicación sobre una copia del entorno sigue siendo parte de la operación de despliegue.
