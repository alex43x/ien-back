const { C, escapeHtml, wrap, header, brandFooter, card, spacer, btn, label, title, body } = require('./base');

function planAbandonado(nombre, baseUrl) {
  const frontUrl = baseUrl || process.env.FRONTEND_URL || 'https://ien.app';
  const html = wrap(`
    ${header()}
    ${card(`
      ${label('Tu programa quedó pausado', C.red)}
      ${title('Te esperamos cuando quieras volver')}
      ${body('Hola, <strong>' + escapeHtml(nombre) + '</strong>,')}
      ${body('Llevás 30 días sin actividad, así que marcamos tu programa como <strong>abandonado</strong>. No te preocupes: tus datos quedan guardados.')}
      ${body('Cuando vuelvas a ingresar, podés retomar tu programa desde cero cuando quieras.')}
      ${btn('Volver al programa', frontUrl + '/dashboard', C.red)}
    `, C.red)}
    ${spacer()}
    ${brandFooter()}
  `);
  return { asunto: escapeHtml(nombre) + ', tu programa quedó pausado', html };
}

module.exports = { planAbandonado };
