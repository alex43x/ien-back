<<<<<<< HEAD
const { FONT, C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
=======
const { FONT, C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

function recordatorioDiario(nombre, dia, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Día ' + dia, C.gold)}
      ${title('No olvides tu actividad de hoy')}
<<<<<<< HEAD
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
=======
      ${body('Hola, <strong>' + nombre + '</strong>,')}
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
      ${body('Aún no completaste tu actividad del <strong>Día ' + dia + '</strong>. Son solo unos minutos — hacelo ahora y no pierdas tu racha.')}
      ${body('Cada día que completás es un paso más hacia tu mejor versión.')}
      ${btn('Completar ahora', frontUrl + '/dashboard', C.gold)}
    `, C.gold)}
    ${spacer()}
    ${brandFooter()}
  `);
<<<<<<< HEAD
  return { asunto: escapeHtml(nombre) + ', no olvides completar tu actividad del Día ' + dia, html };
=======
  return { asunto: nombre + ', no olvides completar tu actividad del Día ' + dia, html };
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
}

module.exports = { recordatorioDiario };
