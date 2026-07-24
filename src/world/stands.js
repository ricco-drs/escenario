import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '../core/scene.js';
import { loft } from '../geometry/loft.js';
import { oval, ovalAt } from '../geometry/oval.js';
import {
  PERIM, D0, FOSO, FILAS, HUELLA, CONTRA, D_TOP, Y_TOP,
  BLOQUES, GRUPOS, HUECOS, esEscalera, LIMITE, LIMITES, COLOR,
} from '../config.js';

/**
 * Graderías de hormigón repartidas en bloques, según el mapa de localidades:
 * cada bloque es una sección vendible y entre bloques hay una escalera.
 * Los tramos sin sección (la mayor parte de la cabecera Sur) se construyen
 * igual pero apagados y sin interacción.
 *
 * Las geometrías se fusionan por grupo, así que las 40 secciones se dibujan
 * en cuatro llamadas. La identificación de un bloque es puro cálculo sobre
 * el arco, no hace falta un objeto por sección.
 */

/* ---------- Perfil transversal de la grada ---------- */
function perfilGrada() {
  const p = [
    [D0, -0.5],          // base del muro frontal
    [D0, FOSO],          // coronación del muro
  ];
  for (let i = 0; i < FILAS; i++) {
    p.push([D0 + i * HUELLA,       FOSO + (i + 1) * CONTRA]);   // contrahuella
    p.push([D0 + (i + 1) * HUELLA, FOSO + (i + 1) * CONTRA]);   // huella
  }
  p.push([D_TOP + 2.4, Y_TOP + 0.9]);   // paseo de coronación
  p.push([D_TOP + 3.2, Y_TOP + 1.6]);   // pretil
  p.push([D_TOP + 3.9, Y_TOP + 1.6]);
  p.push([D_TOP + 3.9, -0.5]);          // muro posterior hasta el suelo
  return p;
}

/* ---------- Consultas sobre bloques ---------- */

const normalizar = (s) => ((s % PERIM) + PERIM) % PERIM;

/**
 * Bloque que ocupa un arco, o `null` si ahí no hay sección.
 * Se prueba también una vuelta más adelante, porque un bloque puede cruzar
 * el origen del arco y quedar con `hasta` por encima de PERIM.
 */
export function bloqueDeArco(s) {
  const n = normalizar(s);
  return BLOQUES.find((b) =>
    (n >= b.desde && n < b.hasta) ||
    (n + PERIM >= b.desde && n + PERIM < b.hasta)) ?? null;
}

/** ¿Ese arco tiene localidades? */
export const haySeccion = (s) => bloqueDeArco(s) !== null;

/** Posición en el mundo de un asiento (fila, arco). */
export function posicionAsiento(fila, s) {
  const d = D0 + fila * HUELLA + 0.45;
  const o = oval(s);
  return {
    x: o.x + o.nx * d,
    y: FOSO + (fila + 1) * CONTRA,
    z: o.z + o.nz * d,
    nx: o.nx,
    nz: o.nz,
  };
}

/* ---------- Textura de hormigón ---------- */
function texturaHormigon() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#a8a79e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) {
    const v = Math.random();
    g.fillStyle = `rgba(${v > .5 ? '255,255,255' : '0,0,0'},${Math.random() * .12})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  for (let i = 0; i < 60; i++) {                 // manchas de humedad
    g.fillStyle = `rgba(90,95,85,${0.03 + Math.random() * 0.07})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512,
              20 + Math.random() * 70, 15 + Math.random() * 50, 0, 0, 7);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/** Divisiones del loft proporcionales al arco, para no gastar de más. */
const pasosDe = (desde, hasta) => Math.max(4, Math.round((hasta - desde) / 1.6));

export function crearGraderias() {
  const grupo = new THREE.Group();
  grupo.name = 'graderias';

  const mapa = texturaHormigon();
  const perfil = perfilGrada();

  /* --- bloques con sección, fusionados por grupo --- */
  const mallasGrupo = new Map();

  for (const g of GRUPOS) {
    const geos = BLOQUES
      .filter((b) => b.grupo === g.id)
      .map((b) => loft(perfil, b.desde, b.hasta, pasosDe(b.desde, b.hasta)));

    const malla = new THREE.Mesh(
      mergeGeometries(geos, false),
      new THREE.MeshStandardMaterial({
        color: COLOR.hormigon, map: mapa,
        roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
      })
    );
    malla.castShadow = true;
    malla.receiveShadow = true;
    malla.name = `grada-${g.id}`;
    malla.userData.grupo = g;
    grupo.add(malla);
    mallasGrupo.set(g.id, malla);
  }

  /* --- tramos sin sección: mismo hormigón, apagado y sin interacción --- */
  const geosMuertas = HUECOS.map((h) =>
    loft(perfil, h.desde, h.hasta, pasosDe(h.desde, h.hasta)));

  const sinSeccion = new THREE.Mesh(
    mergeGeometries(geosMuertas, false),
    new THREE.MeshStandardMaterial({
      color: COLOR.sinSeccion, map: mapa,
      roughness: 0.97, metalness: 0, side: THREE.DoubleSide,
    })
  );
  sinSeccion.castShadow = true;
  sinSeccion.receiveShadow = true;
  sinSeccion.name = 'sin-seccion';
  sinSeccion.raycast = () => {};        // literalmente no se puede clicar
  grupo.add(sinSeccion);

  /* --- escaleras --- *
   * En los huecos estrechos entre bloques va una escalera de paso. En el
   * arranque de un tramo vacío va una escalera de límite, más ancha y
   * rematada con un pretil que cierra el sector vendible.
   */
  const tramos = [
    // escaleras de paso: una en cada hueco estrecho entre bloques
    ...HUECOS.filter(esEscalera).map((h) => ({
      centro: (h.desde + h.hasta) / 2,
      ancho: (h.hasta - h.desde) * 0.78,
      cierre: 0,
    })),
    // escaleras de límite: declaradas en config, existan o no las secciones
    ...LIMITES.map((l) => ({ centro: l.s, ancho: LIMITE.ancho, cierre: l.cierre })),
  ];

  const escaleras = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: COLOR.hormigonSucio, map: mapa, roughness: 0.9,
    }),
    tramos.length * FILAS * 2
  );
  escaleras.castShadow = true;
  escaleras.receiveShadow = true;
  escaleras.name = 'escaleras';
  escaleras.raycast = () => {};

  const m = new THREE.Object3D();
  let k = 0;
  for (const { centro, ancho } of tramos) {
    for (let i = 0; i < FILAS; i++) {
      // dos peldaños por fila: la escalera sube al doble de frecuencia
      for (let mitad = 0; mitad < 2; mitad++) {
        const d = D0 + (i + mitad * 0.5) * HUELLA + HUELLA * 0.25;
        const y = FOSO + (i + mitad * 0.5 + 0.5) * CONTRA;
        const p = ovalAt(centro, d);
        const o = oval(centro);
        m.position.set(p.x, y, p.z);
        m.rotation.set(0, Math.atan2(o.nx, o.nz), 0);
        m.scale.set(ancho, CONTRA * 0.5, HUELLA * 0.5);
        m.updateMatrix();
        escaleras.setMatrixAt(k++, m.matrix);
      }
    }
  }
  escaleras.count = k;
  grupo.add(escaleras);

  /* --- pretil de límite --- *
   * Muro escalonado que cierra el último bloque contra la cabecera vacía:
   * marca dónde acaba la zona con localidades.
   */
  const cierres = tramos.filter((t) => t.cierre !== 0);
  if (cierres.length) {
    const pretil = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: COLOR.hormigonSucio, map: mapa, roughness: 0.88,
      }),
      cierres.length * FILAS
    );
    pretil.castShadow = true;
    pretil.receiveShadow = true;
    pretil.name = 'limites';
    pretil.raycast = () => {};

    let j = 0;
    for (const t of cierres) {
      const arco = t.centro + t.cierre * (t.ancho / 2 + LIMITE.grosor / 2);
      const o = oval(arco);
      const giro = Math.atan2(o.nx, o.nz);

      for (let i = 0; i < FILAS; i++) {
        // cada tramo se apoya en su peldaño: la huella i corona a esa altura
        const d = D0 + (i + 0.5) * HUELLA;
        const y = FOSO + (i + 1) * CONTRA + LIMITE.pretil / 2;
        const p = ovalAt(arco, d);
        m.position.set(p.x, y, p.z);
        m.rotation.set(0, giro, 0);
        m.scale.set(LIMITE.grosor, LIMITE.pretil, HUELLA * 1.02);
        m.updateMatrix();
        pretil.setMatrixAt(j++, m.matrix);
      }
    }
    pretil.count = j;
    grupo.add(pretil);
  }

  /* --- barandas del paseo superior --- */
  const baranda = new THREE.Mesh(
    loft([[D_TOP + 3.2, Y_TOP + 1.6], [D_TOP + 3.2, Y_TOP + 2.5]], 0, PERIM, 300),
    new THREE.MeshStandardMaterial({
      color: COLOR.acero, roughness: 0.55, metalness: 0.5,
      side: THREE.DoubleSide, transparent: true, opacity: 0.7,
    })
  );
  baranda.raycast = () => {};
  grupo.add(baranda);

  /* --- muro perimetral exterior --- */
  const muro = new THREE.Mesh(
    loft([[D_TOP + 14, 0], [D_TOP + 14, 3.4], [D_TOP + 14.9, 3.4], [D_TOP + 14.9, 0]],
         0, PERIM, 260),
    new THREE.MeshStandardMaterial({
      color: COLOR.muro, roughness: 0.95, side: THREE.DoubleSide,
    })
  );
  muro.castShadow = true;
  muro.receiveShadow = true;
  muro.raycast = () => {};
  grupo.add(muro);

  scene.add(grupo);

  return {
    grupo,
    /** Mallas clicables: sólo los bloques con sección. */
    clicables: [...mallasGrupo.values()],
  };
}
