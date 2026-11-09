import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Only anonymous requests: no real profiles, cookies or tokens are used.
const base = new URL(process.argv[2] || 'http://127.0.0.1:4173');
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Expected an HTTP(S) URL');
function request(path, headers = []) {
  const output = execFileSync('curl', ['--silent', '--show-error', '--max-time', '20',
    ...headers.flatMap(value => ['--header', value]), '--write-out', '\n%{http_code}', new URL(path, base).href], {encoding:'utf8'});
  const index = output.lastIndexOf('\n');
  return {status: Number(output.slice(index + 1)), body: output.slice(0,index)};
}
const health = request('/api/health');
assert.equal(health.status,200); assert.equal(JSON.parse(health.body).ok,true);
const page = request('/');assert.equal(page.status,200);assert.match(page.body,/Чудозвери/);
for (const asset of ['/art/retina/chudik-evolution@2x.webp','/art/retina/actions/chudik-0@2x.webp','/art/retina/portraits/luna@2x.webp']) {
  const status = execFileSync('curl',['--silent','--show-error','--max-time','20','--output','/dev/null','--write-out','%{http_code}',new URL(asset,base).href],{encoding:'utf8'});
  assert.equal(status,'200');
}
assert.equal(request('/api/game').status,401);
assert.equal(request('/api/game',['x-telegram-init-data: invalid']).status,401);
// This header is trusted only after the Sites gateway strips user input.
if (base.hostname.endsWith('.chatgpt.site')) {
  assert.equal(request('/api/game',['oai-authenticated-user-id: security-smoke-test']).status,401);
}
console.log('PASS: health, page, Retina scene, animation and portrait files, anonymous/invalid Telegram access and Sites header isolation');
