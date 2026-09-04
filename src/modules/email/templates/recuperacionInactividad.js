<<<<<<< HEAD
const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
=======
const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

function recuperacionInactividad(nombre, dia, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Día ' + dia, C.teal)}
      ${title('Te extrañamos en tu programa')}
<<<<<<< HEAD
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
=======
      ${body('Hola, <strong>' + nombre + '</strong>,')}
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
      ${body('Notamos que llevás varios días sin completar una actividad. Estás en el <strong>Día ' + dia + '</strong> — retomarlo hoy hace toda la diferencia.')}
      ${body('No importa cuántos días hayan pasado. Lo que importa es que hoy elegís volver.')}
      ${btn('Reanudar mi programa', frontUrl + '/dashboard', C.teal)}
    `, C.teal)}
    ${spacer()}
    ${brandFooter()}
  `);
<<<<<<< HEAD
  return { asunto: escapeHtml(nombre) + ', te extrañamos en tu programa', html };
=======
  return { asunto: nombre + ', te extrañamos en tu programa', html };
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
}

module.exports = { recuperacionInactividad };
