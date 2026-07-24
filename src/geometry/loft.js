import * as THREE from 'three';
import { oval } from './oval.js';

/**
 * Extruye un perfil transversal `[[d, y], ...]` a lo largo del óvalo.
 * Es la operación con la que se generan graderías, muros y cubiertas:
 * se dibuja la sección una sola vez y se barre por todo el recorrido.
 *
 * @param {Array<[number, number]>} perfil  puntos (distancia, altura)
 * @param {number} s0  arco inicial
 * @param {number} s1  arco final
 * @param {number} pasos  divisiones a lo largo del recorrido
 */
export function loft(perfil, s0, s1, pasos) {
  const n = perfil.length;
  const pos = [], uv = [], idx = [];

  for (let i = 0; i <= pasos; i++) {
    const s = s0 + (s1 - s0) * (i / pasos);
    const o = oval(s);
    for (let j = 0; j < n; j++) {
      const [d, y] = perfil[j];
      pos.push(o.x + o.nx * d, y, o.z + o.nz * d);
      uv.push((i / pasos) * 60, j / (n - 1));
    }
  }

  for (let i = 0; i < pasos; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + n;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
