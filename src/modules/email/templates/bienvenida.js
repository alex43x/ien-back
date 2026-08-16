const { FONT, C, wrap, header, brandFooter, card, spacer, label, title, body, signoff } = require('./base');

function bienvenida(nombre, tienda) {
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Día 0', C.gold)}
      ${title('Tu mente y tu corazón inician un viaje integral hoy')}
      ${body('Hola, <strong>' + nombre + '</strong>,')}
      ${body('Gracias por activar tu programa en <strong>' + tienda + '</strong>.')}
      ${body('Bienvenido/a a <strong>"Cuidamos de tu mente y de tu corazón"</strong>. Estamos muy felices de que hayas decidido dar este paso hacia una salud integral.')}
      ${body('Durante los próximos 30 días, con 5 a 10 min al día, vamos a trabajar el eslabón perdido de la vitalidad: la <strong>Inteligencia Emocional aplicada a la salud</strong>.')}
    `, C.gold)}
    ${spacer(8)}
    ${card(`
      <p style="margin:0 0 16px;font-family:${FONT.inter};font-size:15px;font-weight:500;color:${C.text};">Nuestra Hoja de Ruta de Bienestar</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${['Autoconciencia', 'Autoconfianza', 'Autocontrol', 'Automotivación', 'Empatía', 'Competencia Social'].map(function(c) {
          return '<tr><td style="padding:14px 0;border-bottom:1px solid ' + C.border + ';"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="8" valign="top"><div style="width:6px;height:6px;border-radius:50%;background:' + C.gold + ';margin-top:7px;"></div></td><td style="padding-left:10px;"><p style="margin:0;font-family:' + FONT.inter + ';font-size:14px;font-weight:500;color:' + C.text + ';">' + c + '</p></td></tr></table></td></tr>';
        }).join('')}
      </table>
    `, C.teal)}
    ${spacer(8)}
    ${card(`
      ${signoff(tienda)}
    `, C.teal)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: nombre + ', tu transformación de 30 días comienza hoy', html };
}

module.exports = { bienvenida };
