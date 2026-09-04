<<<<<<< HEAD
const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
=======
const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91

function recuperacionContrasena(nombre, resetUrl) {
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Contraseña', C.red)}
      ${title('Recuperá tu contraseña')}
<<<<<<< HEAD
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
=======
      ${body('Hola, <strong>' + nombre + '</strong>,')}
>>>>>>> 317d38c70d6a3dbdd5746502de469fe5ef92be91
      ${body('Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el botón de abajo para crear una nueva.')}
      ${btn('Restablecer contraseña', resetUrl, C.red)}
      ${body('<span style="font-size:13px;color:' + C.muted + ';">Este enlace expira en 15 minutos. Si no solicitaste este cambio, podés ignorar este mensaje.</span>')}
    `, C.red)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: 'Recuperá tu contraseña', html };
}

module.exports = { recuperacionContrasena };
