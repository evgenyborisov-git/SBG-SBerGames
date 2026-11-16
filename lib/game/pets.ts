export const petIds = ['chudik', 'luna', 'peach', 'otter', 'owl', 'deer', 'hedgehog', 'squirrel', 'badger', 'whale', 'lynx', 'griffin'] as const;
export type PetId = typeof petIds[number];
export function isPetId(value: unknown): value is PetId {
  return typeof value === 'string' && (petIds as readonly string[]).includes(value);
}
