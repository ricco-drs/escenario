import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { ovalAt } from '../geometry/oval.js';
import { CANCHA, D_TOP, Y_TOP, A } from '../config.js';

/** Arcos, banderines y mobiliario menor del recinto. */
export function crearDetalles() {
  const grupo = new THREE.Group();
  grupo.name = 'detalles';

  const matBlanco = new THREE.MeshStandardMaterial({ color: 0xf1f3ef, roughness: 0.45 });
  const matRed = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.22,
    side: THREE.DoubleSide, roughness: 1,
  });

  /* --- porterías --- */
  for (const s of [-1, 1]) {
    const arco = new THREE.Group();
    const poste = (z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), matBlanco);
      m.position.set(0, 1.22, z);
      m.castShadow = true;
      return m;
    };
    arco.add(poste(-3.66), poste(3.66));

    const travesano = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 7.32, 8), matBlanco
    );
    travesano.rotation.x = Math.PI / 2;
    travesano.position.y = 2.44;
    arco.add(travesano);

    const red = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.44, 7.32), matRed);
    red.position.set(s * 0.9, 1.22, 0);
    arco.add(red);

    arco.position.x = s * (CANCHA.largo / 2);
    grupo.add(arco);
  }

  /* --- banderines de córner --- */
  const matBandera = new THREE.MeshStandardMaterial({
    color: 0xe8c33a, side: THREE.DoubleSide, roughness: 0.9,
  });
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const g = new THREE.Group();
    const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), matBlanco);
    asta.position.y = 0.75;
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), matBandera);
    tela.position.set(0.22, 1.34, 0);
    g.add(asta, tela);
    g.position.set(x * CANCHA.largo / 2, 0, z * CANCHA.ancho / 2);
    grupo.add(g);
  }

  /* --- banquillos junto a la pista, lado occidente --- */
  const matBanco = new THREE.MeshStandardMaterial({ color: 0xdfe2dc, roughness: 0.5 });
  for (const x of [-14, 14]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(8, 1.9, 2.2), matBanco);
    b.position.set(x, 0.95, -(CANCHA.ancho / 2 + 8));
    b.castShadow = true;
    grupo.add(b);
  }

  /* --- caseta de control sobre el paseo de occidente --- */
  const caseta = new THREE.Mesh(
    new THREE.BoxGeometry(7, 3.2, 3),
    new THREE.MeshStandardMaterial({ color: 0xb9bcb4, roughness: 0.8 })
  );
  const p = ovalAt(A - 20, D_TOP + 1.5);      // paseo de Occidente
  caseta.position.set(p.x, Y_TOP + 3.0, p.z);
  caseta.lookAt(0, Y_TOP + 3.0, 0);
  caseta.castShadow = true;
  grupo.add(caseta);

  scene.add(grupo);
  return grupo;
}
