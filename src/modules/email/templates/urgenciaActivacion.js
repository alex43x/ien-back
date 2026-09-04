<<<<<<< HEAD
const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
=======
const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

function urgenciaActivacion(nombre, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Activación', C.gold)}
      ${title('Tu transformación te está esperando')}
<<<<<<< HEAD
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
=======
      ${body('Hola, <strong>' + nombre + '</strong>,')}
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
      ${body('Te registraste pero todavía no activaste tu programa. Los primeros 7 días son clave.')}
      ${body('Quienes empiezan en los primeros 7 días tienen <strong>3x más probabilidad</strong> de completar la transformación.')}
      ${btn('Activar mi programa', frontUrl + '/dashboard', C.gold)}
    `, C.gold)}
    ${spacer()}
    ${brandFooter()}
  `);
<<<<<<< HEAD
  return { asunto: escapeHtml(nombre) + ', tu transformación te está esperando', html };
=======
  return { asunto: nombre + ', tu transformación te está esperando', html };
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
}

module.exports = { urgenciaActivacion };
