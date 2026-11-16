// Mechanical crops for small cards: avoid decoding four huge scene atlases.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {galleryPets} from '../lib/gallery.ts';
await fs.mkdir('public/art/portraits', {recursive: true});
for (const [index, pet] of galleryPets.entries()) {
  const source = `public/art/guardians-chapter-${pet.chapter}.webp`;
  const meta = await sharp(source).metadata();
  const top = Math.round(index % 3 * meta.height / 3);
  const height = Math.round((index % 3 + 1) * meta.height / 3) - top;
  await sharp(source).extract({left: 0, top, width: Math.round(meta.width / 3), height}).webp({lossless: true}).toFile(`public/art/portraits/${pet.id}.webp`);
}
console.log('Exported 12 baby portrait source crops. Run export-art.mjs for 1x/2x variants.');
