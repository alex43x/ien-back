const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function urgenciaActivacion(nombre, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Activación', C.gold)}
      ${title('Tu transformación te está esperando')}
      ${body('Hola, <strong>' + nombre + '</strong>,')}
      ${body('Te registraste pero todavía no activaste tu programa. Los primeros 7 días son clave.')}
      ${body('Quienes empiezan en los primeros 7 días tienen <strong>3x más probabilidad</strong> de completar la transformación.')}
      ${btn('Activar mi programa', frontUrl + '/dashboard', C.gold)}
    `, C.gold)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: nombre + ', tu transformación te está esperando', html };
}

module.exports = { urgenciaActivacion };
