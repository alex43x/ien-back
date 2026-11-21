# Auditoría interna del programa

Esta guía describe el modo transaccional. Para la base de producción actual en `admin`, seguir el [procedimiento operativo del README](README.md#auditoría-de-rachas-en-northflank).

La auditoría empieza cuando se activa este backend y conserva 180 días de eventos. Guarda los cambios del plan y su evidencia en una transacción. Los eventos de autenticación y lectura son de mejor esfuerzo. Una lectura de un plan abandonado que provoca una reactivación sí requiere evidencia atómica. El calendario UTC y las reglas de inactividad siguen siendo los del programa.

## Antes de desplegar

1. Validar en un entorno con red, versión de MongoDB y roles equivalentes a producción. Usar un replica set y TLS con verificación de certificado. Verificar la red privada, el cifrado de almacenamiento y el acceso a respaldos. No reutilizar las credenciales de producción en pruebas.
2. Con una identidad de mantenimiento, inyectar `AUDIT_MAINTENANCE_URI` mediante el gestor de secretos y ejecutar `node scripts/auditoria-db.js preparar`. La URI debe señalar a la misma base que `MONGO_URI`. El comando crea la colección, el validador estricto y sus índices. Puede repetirse si ya existe la misma estructura.
3. Crear una identidad para el backend con los permisos habituales **limitados a cada colección del programa**. Revisar los permisos efectivos, incluidos los roles heredados. Eliminar `readWrite`, `dbOwner` u otros roles globales que concedan permisos adicionales sobre la auditoría. Agregar estos permisos mínimos de auditoría al usuario del backend:

| Recurso | Acciones |
| --- | --- |
| `eventos_auditoria` en la base de la aplicación | `insert`, `listIndexes` |
| Base de la aplicación, sin limitar a una colección | `listCollections` |

4. Crear otra identidad de operación con permiso `find` únicamente sobre `eventos_auditoria`. Mantener su URI fuera del contenedor web. Si el proveedor no permite estos roles, detener el despliegue hasta disponer de permisos equivalentes. Probar también con las credenciales reales de la aplicación sus rutas y trabajos habituales.
5. Configurar `AUDIT_BUILD_VERSION` con el SHA del build, luego desplegar el backend. En producción el proceso solo queda disponible si pudo verificar la versión, la topología, el validador, los índices, los permisos efectivos y la capacidad de insertar en una transacción que se aborta. Validar las comprobaciones de disponibilidad antes de activar tráfico y jobs.
6. En un entorno de prueba, completar una actividad, ejecutar los jobs con datos ficticios y consultar los eventos. Comparar latencia y volumen contra el backend anterior en el entorno de prueba antes de autorizar el despliegue. Vigilar `auditoria_perdidas`, los 503 de progreso, jobs `parcial` o `error`, ejecuciones sin cierre y crecimiento de la colección.

La aplicación limita las escrituras de observación a 16 simultáneas por proceso, con 750 ms por operación. Limita los eventos anónimos a 120 por minuto por proceso. Las pérdidas se agregan en logs cada 30 segundos sin identidades ni mensajes de error originales. Un cierre brusco puede descartar observaciones en tránsito o contadores pendientes.

Ante un 503 por resultado de commit incierto, consultar el progreso y la auditoría antes de reenviar. Si MongoDB confirmó el cambio, ambos registros existen. Ante una interrupción del despliegue, mantener los jobs pausados y la última versión que garantice auditoría durante la corrección. Si se vuelve a una versión anterior a la auditoría, cualquier escritura de esa versión quedará fuera de esta garantía. Conservar la colección y registrar el intervalo sin cobertura.

## Consulta

Desde una terminal autorizada con acceso privado a MongoDB, inyectar `AUDIT_READER_URI` y ejecutar:

```sh
node scripts/auditoria-consultar.js --usuario ID_INTERNO --desde 2026-11-01T03:00:00.000Z --hasta 2026-11-19T03:00:00.000Z --zona America/Asuncion
```

Usar un rango UTC cerrado al inicio y abierto al final. La zona solo cambia la presentación de la tabla. Se puede sustituir el selector de usuario por `--solicitud UUID` o `--job UUID` para investigar un evento vinculado. El identificador de solicitud figura en los logs HTTP del backend. Usar `--evento TIPO` para acotar, `--cursor FECHA/ID` para continuar y `--json` para exportar. Cada página devuelve hasta 100 eventos. En JSON las fechas se mantienen en UTC.

Una identidad desconocida no se puede buscar por cuenta. Un 304 significa que el servidor atendió una consulta condicional. Ni ese estado ni un 200 prueban que la persona leyó la pantalla. El día en un rechazo de guardado corresponde al plan que consultó el servidor, cuando llegó a consultarlo. El cliente actual no envía el día que tenía abierto. La ausencia de una observación tampoco prueba ausencia de actividad, y la auditoría no recupera envíos que nunca llegaron.

El índice TTL elimina los eventos vencidos de forma asíncrona. La CLI los excluye desde su vencimiento. Definir vencimiento y destrucción para respaldos y exportaciones antes de habilitar el uso operativo. Mantener los archivos exportados fuera del repositorio y del almacenamiento público. Los administradores de la base de datos pueden cambiar los registros, por lo que deben gestionarse con controles separados.

## Pruebas locales

`npm test` arranca un replica set desechable en loopback y genera sus propias credenciales. Ignora `MONGO_URI`. Para ejecutar un grupo concreto, usar por ejemplo `npm test -- tests/eventosAuditoria.test.js tests/permisosAuditoria.test.js`. Si se usa un binario de MongoDB instalado, indicar su ruta mediante `MONGOMS_SYSTEM_BINARY`.
