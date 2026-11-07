const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function planReiniciado(nombre, dia, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Nuevo comienzo', C.teal)}
      ${title('Retomamos tu programa desde el inicio')}
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
      ${body('Pasó más de una semana sin actividad y reiniciamos tu programa desde el <strong>Día 1</strong> para que vuelvas a empezar con energía.')}
      ${body('Tus hitos de racha alcanzados se mantienen. Lo importante es que hoy decidís volver.')}
      ${btn('Empezar de nuevo', frontUrl + '/dashboard', C.teal)}
    `, C.teal)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: escapeHtml(nombre) + ', retomamos tu programa desde el inicio', html };
}

module.exports = { planReiniciado };
