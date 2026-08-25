import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ignoredPathFragments = ['/node_modules/', '/dist/', '/.git/'];
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((path) => !ignoredPathFragments.some((fragment) => path.includes(fragment)))
  .filter((path) => !path.endsWith('package-lock.json'));

const patterns = [
  [/\bsb_secret_[A-Za-z0-9_-]{20,}\b/u, 'Supabase secret key'],
  [/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/u, 'GitHub personal access token'],
  [/\bsk_(?:live|test)?_[A-Za-z0-9_-]{20,}\b/u, 'third-party secret key'],
  [
    /\b(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|POSTMARK_SERVER_TOKEN|PRELUDE_API_KEY)\s*[:=]\s*["']?(?!REPLACE|YOUR_|\$\{|\$)[A-Za-z0-9._-]{16,}/u,
    'named secret assignment',
  ],
];

const findings = [];
for (const path of trackedFiles) {
  const content = readFileSync(path, 'utf8');
  for (const [pattern, label] of patterns) {
    if (pattern.test(content)) findings.push(`${path}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error('Potential secret material is committed:\n' + findings.map((finding) => `- ${finding}`).join('\n'));
  process.exit(1);
}

console.log(`Secret hygiene passed for ${trackedFiles.length} tracked files.`);
