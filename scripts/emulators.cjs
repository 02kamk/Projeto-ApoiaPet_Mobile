const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const cli = path.join(root, '.local-tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js');
if (!fs.existsSync(cli)) {
  console.error('Instale a ferramenta local: npm.cmd install --prefix .local-tools/firebase firebase-tools --no-audit --no-fund');
  process.exit(1);
}
const env = { ...process.env, FIREBASE_EMULATORS_PATH: path.join(root, '.local-tools/emulators'), XDG_CONFIG_HOME: path.join(root, '.local-tools/config'), CI: 'true', FIREBASE_CLI_DISABLE_MOTD: 'true' };
if (spawnSync('java', ['-version'], { env, stdio: 'ignore' }).error) {
  const bundledJava = 'C:\\Program Files\\Android\\Android Studio\\jbr';
  if (!fs.existsSync(path.join(bundledJava, 'bin/java.exe'))) {
    console.error('Java 21+ não encontrado. Instale um JDK ou configure JAVA_HOME antes de iniciar.');
    process.exit(1);
  }
  env.JAVA_HOME = bundledJava;
  env.PATH = `${path.join(bundledJava, 'bin')}${path.delimiter}${env.PATH}`;
}
const save = process.argv.includes('--save');
const args = save
  ? ['emulators:export', '.emulator-data', '--force', '--project', 'demo-apoiapet']
  : ['emulators:start', '--project', 'demo-apoiapet', '--only', 'auth,firestore', '--export-on-exit=.emulator-data'];
if (!save && fs.existsSync(path.join(root, '.emulator-data/firebase-export-metadata.json'))) args.push('--import=.emulator-data');
const child = spawn(process.execPath, [cli, ...args], { cwd: root, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
