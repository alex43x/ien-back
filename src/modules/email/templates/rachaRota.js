<<<<<<< HEAD
const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
=======
const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

function rachaRota(nombre, racha, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Racha', C.red)}
      ${title('Se rompió tu racha de ' + racha + ' días')}
<<<<<<< HEAD
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
=======
      ${body('Hola, <strong>' + nombre + '</strong>,')}
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
      ${body('Lamentablemente perdiste tu racha de <strong>' + racha + ' días</strong>. Sabemos que no es fácil, y entendemos que la vida a veces se pone complicada.')}
      ${body('Pero esto no es un final — es una oportunidad para empezar de nuevo. Lo importante no es la perfección, es la constancia.')}
      ${btn('Volver a empezar hoy', frontUrl + '/dashboard', C.teal)}
    `, C.red)}
    ${spacer()}
    ${brandFooter()}
  `);
<<<<<<< HEAD
  return { asunto: escapeHtml(nombre) + ', se rompió tu racha de ' + racha + ' días', html };
=======
  return { asunto: nombre + ', se rompió tu racha de ' + racha + ' días', html };
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
}

module.exports = { rachaRota };
