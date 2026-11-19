const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

async function main() {
  const password = randomUUID();
  const replica = await MongoMemoryReplSet.create({
    replSet: {
      count: 1, ip: '127.0.0.1', args: ['--setParameter', 'enableTestCommands=1'],
      auth: { enable: true, customRootName: 'testroot', customRootPwd: password },
      configSettings: { electionTimeoutMillis: 1000, heartbeatIntervalMillis: 500 }
    }
  });
  try {
    const uri = new URL(replica.getUri('ien_test'));
    uri.username = 'testroot';
    uri.password = password;
    uri.searchParams.set('authSource', 'admin');
    const jest = spawn(process.execPath, [
      require.resolve('jest/bin/jest'), '--runInBand', '--forceExit', ...process.argv.slice(2)
    ], {
      stdio: 'inherit',
      env: { ...process.env, MONGO_URI: '', MONGO_TEST_URI: uri.toString() }
    });
    process.exitCode = await new Promise((resolve, reject) => {
      jest.once('error', reject);
      jest.once('exit', code => resolve(code ?? 1));
    });
  } finally {
    await replica.stop();
  }
}

main().catch(() => {
  console.error('No se pudo ejecutar la suite con MongoDB local.');
  process.exitCode = 1;
});
