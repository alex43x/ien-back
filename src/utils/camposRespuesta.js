function mapearCamposRespuesta(pasos) {
  return Array.isArray(pasos)
    ? pasos
        .filter(p => !p.eliminado)
        .filter(p => p.respuesta_tipo !== 'accion' || p.texto)
        .map((p, i) => ({
          id: p.id || `paso_${i + 1}`,
          etiqueta: (typeof p.texto === 'string' ? p.texto : `Paso ${i + 1}`).substring(0, 300),
          tipo: p.respuesta_tipo === 'escala' ? 'escala'
            : p.respuesta_tipo === 'accion' ? 'accion'
            : p.respuesta_tipo === 'tabla' ? 'tabla'
            : 'texto',
          min: p.min,
          max: p.max,
          ...(p.respuesta_tipo === 'tabla' ? {
            columnas: p.columnas,
            filas: p.filas,
            requerido: p.requerido || 'todas'
          } : {}),
          ...(p.layout ? { layout: p.layout } : {})
        }))
    : [];
}

module.exports = { mapearCamposRespuesta };
