import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Butaca: asiento, respaldo y base, en una sola geometría para poder
 * instanciarla miles de veces. Mira hacia +x en coordenadas locales, así que
 * basta con girarla en Y para orientarla hacia el campo.
 */
let cache = null;

export function geometriaButaca() {
  if (cache) return cache;

  const asiento = new THREE.BoxGeometry(0.42, 0.10, 0.44);
  asiento.translate(0, 0.22, 0);

  const respaldo = new THREE.BoxGeometry(0.10, 0.34, 0.44);
  respaldo.translate(-0.19, 0.34, 0);         // a la espalda del ocupante

  const base = new THREE.BoxGeometry(0.30, 0.22, 0.32);
  base.translate(0, 0.11, 0);

  cache = mergeGeometries([asiento, respaldo, base], false);
  return cache;
}

/**
 * Giro en Y para que la butaca mire hacia el interior del estadio, dada la
 * normal exterior de la curva en ese punto.
 */
export const giroHaciaElCampo = (nx, nz) => Math.atan2(nz, -nx);
