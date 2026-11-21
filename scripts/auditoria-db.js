const { mongo } = require('mongoose');
const { provision } = require('../src/modules/auditoria/storage');

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== 'preparar' || !process.env.AUDIT_MAINTENANCE_URI) {
    throw new Error('Uso: node scripts/auditoria-db.js preparar (requiere AUDIT_MAINTENANCE_URI)');
  }
  const client = new mongo.MongoClient(process.env.AUDIT_MAINTENANCE_URI, { timeoutMS: 10000 });
  try {
    await provision(client.db());
    console.log('Almacenamiento e índices de auditoría preparados.');
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(error.message.startsWith('Uso:') ? error.message : 'No se pudo preparar la auditoría.');
  process.exitCode = 1;
});
