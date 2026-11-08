const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function planReiniciado(nombre, dia, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Nuevo comienzo', C.teal)}
      ${title('Retomamos tu programa desde el inicio')}
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
      ${body('Pasó una semana sin actividad y cerramos tu intento anterior. Tenés un nuevo intento listo para comenzar desde el <strong>Día 1</strong> cuando lo decidas.')}
      ${body('Las respuestas y los hitos de tu intento anterior quedan conservados en su historial. El nuevo intento comienza con su propio progreso.')}
      ${btn('Empezar de nuevo', frontUrl + '/dashboard', C.teal)}
    `, C.teal)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: escapeHtml(nombre) + ', retomamos tu programa desde el inicio', html };
}

module.exports = { planReiniciado };
