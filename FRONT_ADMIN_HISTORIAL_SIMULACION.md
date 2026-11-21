# Contrato para el frontend administrativo

Estos endpoints están preparados en la rama `dev` del backend. Requieren el JWT habitual en `Authorization: Bearer <token>`. El frontend no debe consultar MongoDB directamente.

## Planes actuales y anteriores de un paciente

`GET /api/admin/pacientes/:usuarioId/planes` devuelve `{ "planes": [...] }`. Cada entrada tiene `id`, `tipo`, `fecha_inicio`, `estado`, `dia_actual`, `racha_dias` y `racha_maxima`. Los planes anteriores tienen además `fecha_cierre`, `motivo_cierre` y `dias_completados`. El `id` es `actual` o `anterior-0`, `anterior-1`, etc. La lista muestra primero los anteriores más recientes y al final el actual.

`GET /api/admin/pacientes/:usuarioId/planes/:planId` abre un plan de esa lista. Devuelve sus datos y `dias`, que incluye **solo días completados**. Cada día tiene `dia_numero`, `fecha_completado`, `respuesta_usuario` y `leccion` con `titulo`, `tipo`, `emociones_objetivo`, `respuesta_tipo`, `campos_respuesta` y `datos_leccion`. Si faltó el contenido actual para un día histórico, `leccion` es `null`. Un plan anterior agrega `fecha_cierre` y `motivo_cierre`.

Integración sugerida dentro del detalle del paciente. Mantener el progreso actual como vista principal y añadir una sección o pestaña de «Planes anteriores». Cargar la lista al entrar en esa sección y pedir el detalle solo cuando se abre un plan. Reutilizar la presentación de días completados de las actividades diarias. Mostrar fechas de finalización y respuestas guardadas. Tratar `planes: []` como ausencia de plan. Un `404` significa que el paciente o plan no existe dentro del alcance del administrador. No convertir `dia_actual` en un día completado: representa el siguiente día del programa.

## Simulación propia del administrador

`GET /api/admin/simulacion` devuelve la vista del día simulado del administrador. Si nunca la usó, devuelve día 1 y versión 0. La respuesta incluye `simulacion: true`, `dia_actual`, `version`, `cabecera`, `conclusion`, `contenido_especial` y `leccion`. `leccion` usa la misma estructura que el contenido diario, incluido `campos_respuesta`.

`POST /api/admin/simulacion` recibe `{ "accion": "avanzar", "version": 0 }`. Las acciones admitidas son `avanzar`, `retroceder` y `reiniciar`. `reiniciar` vuelve al día 1. Los extremos se limitan a 1 y 30. La respuesta tiene la misma forma que `GET` y devuelve la nueva `version`. Enviar siempre la última versión recibida. Ante `409`, repetir `GET` y actualizar la vista. Ante `400`, corregir acción o versión.

La simulación es individual para cada administrador y se guarda en `simulaciones_admin`. No utiliza el plan de ningún paciente ni completa actividades reales. Colocarla en una pantalla propia del panel con una indicación visible de «Simulación». Mostrar controles de anterior, siguiente y volver al día 1. El frontend puede reutilizar componentes de lectura del día, pero debe usar exclusivamente estos endpoints para la simulación. No enviar respuestas de ejercicios porque la API de simulación no las almacena.

Los tres roles administrativos pueden acceder a la simulación. Los endpoints de pacientes aplican el alcance de tiendas que ya usa el panel.
