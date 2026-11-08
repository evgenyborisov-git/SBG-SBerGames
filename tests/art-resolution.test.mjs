import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {artBackground, artPreloadUrl} from '../lib/art-resolution.ts';

test('every published artwork displays and preloads the same 2x file regardless of device density', () => {
  const manifest = JSON.parse(fs.readFileSync('public/art/retina/manifest.json', 'utf8'));
  for (const item of manifest.images) {
    const retina = item.variants.find(variant => variant.density === 2);
    assert.equal(artPreloadUrl(item.source), retina.path);
    assert.equal(artBackground(item.source), `url('${retina.path}')`);
    assert.ok(fs.existsSync(`public${retina.path}`));
  }
  const css = fs.readFileSync('app/globals.css', 'utf8');
  assert.doesNotMatch(css, /image-set\(|@1x\.webp/);
  for (const [, source] of css.matchAll(/url\(['"]?(\/art\/[^)'"\s]+)/g)) {
    assert.match(source, /@2x\.webp$/);
    assert.ok(fs.existsSync(`public${source}`));
  }
});
