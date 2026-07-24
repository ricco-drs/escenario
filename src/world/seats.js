import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { geometriaButaca, giroHaciaElCampo } from './chair.js';
import { BLOQUES } from '../config.js';

/**
 * Butacas de la gradería: una por localidad, sobre el peldaño que le toca y
 * orientadas hacia el campo. Todo en una única malla instanciada.
 *
 * Los bloques alternan dos tonos para que las secciones se distingan desde
 * lejos, igual que en el mapa de localidades.
 */

const TONOS = [0x9fb3c8, 0x7d93ab];

export function crearButacas(plazas) {
  const malla = new THREE.InstancedMesh(
    geometriaButaca(),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    plazas.length
  );
  malla.name = 'butacas-grada';
  malla.receiveShadow = true;
  malla.raycast = () => {};           // se clica la grada, no la butaca

  // índice de cada bloque dentro de su grupo, para alternar el tono
  const orden = new Map();
  for (const g of new Set(BLOQUES.map((b) => b.grupo))) {
    BLOQUES.filter((b) => b.grupo === g)
      .forEach((b, i) => orden.set(b.id, i));
  }

  const m = new THREE.Object3D();
  const c = new THREE.Color();

  plazas.forEach((p, i) => {
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(0, giroHaciaElCampo(p.nx, p.nz), 0);
    m.updateMatrix();
    malla.setMatrixAt(i, m.matrix);

    const tono = TONOS[(orden.get(p.bloque.id) ?? 0) % TONOS.length];
    c.setHex(tono).multiplyScalar(0.92 + Math.random() * 0.16);
    malla.setColorAt(i, c);
  });

  malla.instanceMatrix.needsUpdate = true;
  scene.add(malla);

  return {
    malla,
    total: plazas.length,
    setVisible: (v) => { malla.visible = v; },
  };
}
