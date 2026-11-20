// Builds the web version (EXPO_PUBLIC_* from .env.local) and publishes it to the Vercel project in web/project.json.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const run = (command, env = {}) => execSync(command, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
fs.rmSync(dist, { recursive: true, force: true });
run('npx expo export --platform web --output-dir dist');
fs.copyFileSync(path.join(root, 'web/vercel.json'), path.join(dist, 'vercel.json'));
// Deploy only the static files: no `vercel link`, so no credentials are written into dist/.
const { orgId, projectId } = JSON.parse(fs.readFileSync(path.join(root, 'web/project.json'), 'utf8'));
run('npx -y vercel@latest deploy dist --prod --yes', { VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: projectId });
