// Mechanical WebP/density exports. No redraw, sharpening or invented detail.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('public/art');
const output = path.join(root, 'retina');
const catalog = [];
async function visit(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    if (entry.name === 'retina') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {await visit(absolute); continue;}
    if (!/\.(png|webp)$/.test(entry.name)) continue;
    const relative = path.relative(root, absolute);
    let columns = 1, rows = 1, cell = 576;
    if (relative === 'chudik-evolution.png') columns = 3;
    else if (['chudik-reactions.png', 'creatures-gallery.png'].includes(relative)) {columns = 3; rows = 2;}
    else if (relative.startsWith('guardians-')) {columns = 3; rows = 3;}
    else if (relative.startsWith('reactions/')) {columns = 4; rows = 3;}
    else if (/motion\/chudik-/.test(relative)) {columns = 4; rows = 4; cell = 352;}
    const source = await sharp(absolute).metadata();
    const variants = [];
    for (const density of [1, 2]) {
      const target = path.join(output, relative.replace(/\.(png|webp)$/, `@${density}x.webp`));
      await fs.mkdir(path.dirname(target), {recursive: true});
      const result = await sharp(absolute).resize(columns * cell * density, rows * cell * density, {fit: 'fill', kernel: 'lanczos3'}).webp({quality: density === 2 ? 88 : 86, alphaQuality: 100}).toFile(target);
      variants.push({density, width: result.width, height: result.height, bytes: result.size, path: `/art/retina/${path.relative(output, target)}`});
    }
    catalog.push({source: `/art/${relative}`, sourceWidth: source.width, sourceHeight: source.height, alpha: source.hasAlpha, columns, rows, cell1x: cell, upscaled: source.width < columns * cell * 2, variants});
  }
}
await visit(root);
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({method: 'lanczos3_export_not_native_redraw', images: catalog}, null, 2) + '\n');
console.log(JSON.stringify({sources: catalog.length, variants: catalog.length * 2, bytes: catalog.flatMap(x => x.variants).reduce((n, x) => n + x.bytes, 0)}));
