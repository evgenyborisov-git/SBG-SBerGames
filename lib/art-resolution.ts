/** Resolution variants are mechanical exports of the retained source artwork. */
export function artVariant(path: string, density: 1 | 2) {
  if (!path.startsWith('/art/') || path.includes('..')) throw new Error('Invalid art path');
  return path.replace('/art/', '/art/retina/').replace(/\.(png|webp)$/, `@${density}x.webp`);
}
export function artBackground(path: string) {
  return `url('${artVariant(path, 2)}')`;
}
export function artPreloadUrl(path: string) {
  return artVariant(path, 2);
}
