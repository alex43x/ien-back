require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { enviarCorreo } = require('../src/modules/email/email.service');
const {
  bienvenida, recordatorioDiario, hito, rachaRota,
  urgenciaActivacion, recuperacionInactividad, recuperacionContrasena
} = require('../src/modules/email/templates');

const DESTINATARIO = process.argv[2] || 'tadeofrr13@gmail.com';
const USUARIO_ID = '000000000000000000000001';

const templates = [
  { nombre: 'bienvenida',              render: () => bienvenida('Tadeo') },
  { nombre: 'recordatorioDiario',      render: () => recordatorioDiario('Tadeo', 5) },
  { nombre: 'hito (día 7)',           render: () => hito('Tadeo', 7) },
  { nombre: 'hito (día 14)',          render: () => hito('Tadeo', 14) },
  { nombre: 'hito (día 21)',          render: () => hito('Tadeo', 21) },
  { nombre: 'hito (día 28)',          render: () => hito('Tadeo', 28) },
  { nombre: 'rachaRota',              render: () => rachaRota('Tadeo', 12) },
  { nombre: 'urgenciaActivacion',     render: () => urgenciaActivacion('Tadeo') },
  { nombre: 'recuperacionInactividad', render: () => recuperacionInactividad('Tadeo', 10) },
  { nombre: 'recuperacionContrasena',  render: () => recuperacionContrasena('Tadeo', 'http://localhost/reset-password?token=test123') },
];

(async () => {
  console.log(`=== Test de ${templates.length} templates de email ===`);
  console.log(`Destinatario: ${DESTINATARIO}\n`);
  let enviados = 0, fallidos = 0;

  for (const t of templates) {
    process.stdout.write(`${t.nombre}... `);
    const { asunto, html } = t.render();
    const result = await enviarCorreo({
      usuario_id: USUARIO_ID,
      destinatario: DESTINATARIO,
      asunto: `[TEST] ${asunto}`,
      html,
      tipo_correo: 'bienvenida',
      meta: { test: true }
    });
    if (result.success) {
      console.log(`✅ (${result.messageId})`);
      enviados++;
    } else {
      console.log(`❌ ${result.error}`);
      fallidos++;
    }
  }

  console.log(`\nResultado: ${enviados} enviados, ${fallidos} fallidos de ${templates.length} total`);
})();
