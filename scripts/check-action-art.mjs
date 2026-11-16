import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const files = (await fs.readdir('public/art/retina/actions')).filter(file => file.endsWith('@2x.webp'));
assert.equal(files.length, 36, '12 pets × 3 ages');
let frames = 0, bytes = 0;
for (const file of files) {
  const path = 'public/art/retina/actions/' + file;
  const {data, info} = await sharp(path).raw().toBuffer({resolveWithObject: true});
  assert.equal(info.width, 2816, file); assert.equal(info.height, 2816, file); assert.equal(info.channels, 4, file);
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const x = column * 704, y = row * 704;
    for (let n = 0; n < 704; n++) {
      assert.equal(alpha(x + n, y), 0, `${file}: top edge`);
      assert.equal(alpha(x + n, y + 703), 0, `${file}: bottom edge`);
      assert.equal(alpha(x, y + n), 0, `${file}: left edge`);
      assert.equal(alpha(x + 703, y + n), 0, `${file}: right edge`);
    }
    let opaque = 0;
    for (let py = y + 40; py < y + 664; py += 8) for (let px = x + 40; px < x + 664; px += 8) if (alpha(px, py) > 128) opaque++;
    assert.ok(opaque > 300, `${file}: frame ${frames % 16} is empty`);
    frames++;
  }
  bytes += (await fs.stat(path)).size;
}
console.log(JSON.stringify({sheets: files.length, frames, bytes, framePixels: 704, transparentEdges: true}));
