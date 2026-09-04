function mapearCamposRespuesta(pasos) {
  return Array.isArray(pasos)
    ? pasos
<<<<<<< HEAD
        .filter(p => !p.eliminado)
=======
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
        .filter(p => p.respuesta_tipo !== 'accion' || p.texto)
        .map((p, i) => ({
          id: p.id || `paso_${i + 1}`,
          etiqueta: (typeof p.texto === 'string' ? p.texto : `Paso ${i + 1}`).substring(0, 300),
          tipo: p.respuesta_tipo === 'escala' ? 'escala'
            : p.respuesta_tipo === 'accion' ? 'accion'
<<<<<<< HEAD
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
=======
            : 'texto',
          min: p.min,
          max: p.max
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
        }))
    : [];
}

module.exports = { mapearCamposRespuesta };
