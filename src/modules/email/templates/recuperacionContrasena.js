const { C, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function recuperacionContrasena(nombre, resetUrl) {
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Contraseña', C.red)}
      ${title('Recuperá tu contraseña')}
      ${body('Hola, <strong>' + nombre + '</strong>,')}
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
