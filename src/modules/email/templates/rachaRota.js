const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function rachaRota(nombre, racha, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Racha', C.red)}
      ${title('Se rompió tu racha de ' + racha + ' días')}
      ${body('Hola, <strong>' + nombre + '</strong>,')}
      ${body('Lamentablemente perdiste tu racha de <strong>' + racha + ' días</strong>. Sabemos que no es fácil, y entendemos que la vida a veces se pone complicada.')}
      ${body('Pero esto no es un final — es una oportunidad para empezar de nuevo. Lo importante no es la perfección, es la constancia.')}
      ${btn('Volver a empezar hoy', frontUrl + '/dashboard', C.teal)}
    `, C.red)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: nombre + ', se rompió tu racha de ' + racha + ' días', html };
}

module.exports = { rachaRota };
