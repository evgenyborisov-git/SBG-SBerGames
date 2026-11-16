// Source art and both export densities remain in Git. Runtime uses only 2x.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist/client');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'art/retina/manifest.json'), 'utf8'));
for (const item of manifest.images) {
  const retina = item.variants.find(variant => variant.density === 2);
  if (!retina) throw new Error(`Missing 2x variant for ${item.source}`);
  await fs.access(path.join(root, retina.path));
}
let removed = 0;
for (const item of manifest.images) {
  for (const source of [item.source, ...item.variants.filter(variant => variant.density === 1).map(variant => variant.path)]) {
    const target = path.resolve(root, '.' + source);
    if (!target.startsWith(root + '/art/')) throw new Error('Invalid art manifest path');
    await fs.rm(target, {force: true});
    removed++;
  }
}
console.log(`Runtime art: ${manifest.images.length} direct 2x assets; ${removed} source/1x copies omitted from build.`);
