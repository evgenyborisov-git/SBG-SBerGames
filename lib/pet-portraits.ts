import {artBackground} from './art-resolution';
import {galleryPets} from './gallery';
import type {PetId} from './game/pets';

export function petPortrait(petId: PetId, stage = 0) {
  const index = Math.max(0, galleryPets.findIndex(pet => pet.id === petId));
  return {backgroundImage: artBackground(`/art/guardians-chapter-${galleryPets[index].chapter}.webp`), backgroundSize: '300% 300%', backgroundPosition: `${Math.min(2, Math.max(0, stage)) * 50}% ${index % 3 * 50}%`};
}
export const petThumbnail = (petId: PetId) => ({backgroundImage: artBackground(`/art/portraits/${petId}.webp`), backgroundSize: 'cover', backgroundPosition: 'center'});
