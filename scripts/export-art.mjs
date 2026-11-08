// Mechanical WebP/density exports. No redraw, sharpening or invented detail.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('public/art');
const output = path.join(root, 'retina');
const onlyPrefix = process.argv[2];
const catalog = onlyPrefix ? JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8')).images.filter(item => !item.source.startsWith('/art/' + onlyPrefix)) : [];
async function visit(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    if (entry.name === 'retina') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {await visit(absolute); continue;}
    if (!/\.(png|webp)$/.test(entry.name)) continue;
    const relative = path.relative(root, absolute);
    if (onlyPrefix && !relative.startsWith(onlyPrefix)) continue;
    let columns = 1, rows = 1, cell = 576;
    if (relative.startsWith('portraits/')) cell = 384;
    else if (relative === 'chudik-evolution.png') columns = 3;
    else if (['chudik-reactions.png', 'creatures-gallery.png'].includes(relative)) {columns = 3; rows = 2;}
    else if (relative.startsWith('guardians-')) {columns = 3; rows = 3;}
    else if (relative.startsWith('reactions/')) {columns = 4; rows = 3;}
    else if (/motion\/chudik-/.test(relative) || relative.startsWith('actions/')) {columns = 4; rows = 4; cell = 352;}
    const source = await sharp(absolute).metadata();
    const variants = [];
    for (const density of [1, 2]) {
      const target = path.join(output, relative.replace(/\.(png|webp)$/, `@${density}x.webp`));
      await fs.mkdir(path.dirname(target), {recursive: true});
      let pipeline;
      if (relative.startsWith('actions/')) {
        // Normalize each frame independently, retaining aspect ratio and adding
        // transparent gutters. Resizing a rectangular sheet as a square would
        // distort the pet; padding the entire sheet would break sprite positions.
        const size = cell * density;
        const inner = Math.round(size * .9);
        const offset = Math.floor((size - inner) / 2);
        const tiles = [];
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
          const left = Math.round(column * source.width / columns);
          const top = Math.round(row * source.height / rows);
          const width = Math.round((column + 1) * source.width / columns) - left;
          const height = Math.round((row + 1) * source.height / rows) - top;
          const input = await sharp(absolute).extract({left, top, width, height}).resize(inner, inner, {fit: 'contain', background: '#00000000', kernel: 'lanczos3'}).png().toBuffer();
          tiles.push({input, left: column * size + offset, top: row * size + offset});
        }
        pipeline = sharp({create: {width: columns * size, height: rows * size, channels: 4, background: '#00000000'}}).composite(tiles);
      } else pipeline = sharp(absolute).resize(columns * cell * density, rows * cell * density, {fit: 'fill', kernel: 'lanczos3'});
      const result = await pipeline.webp({quality: density === 2 ? 88 : 86, alphaQuality: 100}).toFile(target);
      variants.push({density, width: result.width, height: result.height, bytes: result.size, path: `/art/retina/${path.relative(output, target)}`});
    }
    catalog.push({source: `/art/${relative}`, sourceWidth: source.width, sourceHeight: source.height, alpha: source.hasAlpha, columns, rows, cell1x: cell, upscaled: source.width < columns * cell * 2, variants});
  }
}
await visit(root);
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({method: 'lanczos3_export_not_native_redraw', images: catalog}, null, 2) + '\n');
console.log(JSON.stringify({sources: catalog.length, variants: catalog.length * 2, bytes: catalog.flatMap(x => x.variants).reduce((n, x) => n + x.bytes, 0)}));
