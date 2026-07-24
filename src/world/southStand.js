import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '../core/scene.js';
import { crearMosaico } from './mosaic.js';
import { geometriaButaca } from './chair.js';
import { TRIBUNA_SUR as T } from '../config.js';

/**
 * Tribuna Sur: cinco secciones (A–E) montadas sobre el campo, a ras de suelo
 * —sin gradas ni desnivel—. Cada butaca toma su color del mosaico, de modo
 * que el conjunto compone la bandera vista desde arriba.
 *
 *   z+ ┌──────┬──────┬──────┬──────┬──────┐
 *      │  A   │  B   │  C   │  D   │  E   │   ← el campo queda a la derecha
 *   z− └──────┴──────┴──────┴──────┴──────┘
 */

const ANCHO_SECCION = T.columnas * T.paso;
const FONDO = T.filas * T.fondo;
const ANCHO_TOTAL = T.secciones.length * ANCHO_SECCION
                  + (T.secciones.length - 1) * T.pasillo;

export const LIMITES_TRIBUNA = {
  xMin: T.xFrente - FONDO,
  xMax: T.xFrente,
  zMin: -ANCHO_TOTAL / 2,
  zMax: ANCHO_TOTAL / 2,
};

/** Borde en z donde empieza (lado z+) cada sección. */
function bordeSeccion(i) {
  return LIMITES_TRIBUNA.zMax - i * (ANCHO_SECCION + T.pasillo);
}

/**
 * Altura del peldaño de una fila. La 0 es la más baja, y arranca sobre el
 * muro frontal, igual que en las graderías de hormigón.
 */
export const alturaFila = (fila) => T.foso + (fila + 1) * T.contra;

/** Altura total de la tribuna, del suelo a la última fila. */
export const ALTURA_TOTAL = alturaFila(T.filas - 1);

/** Centro de una butaca. Fila 0 es la más cercana al campo. */
export function posicionButaca(seccion, fila, columna) {
  return {
    x: T.xFrente - (fila + 0.5) * T.fondo,
    y: alturaFila(fila),
    z: bordeSeccion(seccion) - (columna + 0.5) * T.paso,
  };
}

/** Localidad que corresponde a un punto del mundo, o `null` si cae fuera. */
export function localidadEnPunto(x, z) {
  const { xMin, xMax } = LIMITES_TRIBUNA;
  if (x < xMin || x > xMax) return null;

  for (let i = 0; i < T.secciones.length; i++) {
    const borde = bordeSeccion(i);
    const dz = borde - z;
    if (dz < 0 || dz > ANCHO_SECCION) continue;   // en el pasillo o fuera

    const fila = Math.min(T.filas - 1, Math.floor((T.xFrente - x) / T.fondo));
    const columna = Math.min(T.columnas - 1, Math.floor(dz / T.paso));
    return {
      seccion: i,
      letra: T.secciones[i],
      fila,
      columna,
      ...posicionButaca(i, fila, columna),
    };
  }
  return null;
}

export const AFORO_SECCION = T.columnas * T.filas;
export const AFORO_TRIBUNA = AFORO_SECCION * T.secciones.length;

export function crearTribunaSur() {
  const grupo = new THREE.Group();
  grupo.name = 'tribuna-sur';

  const mosaico = crearMosaico(LIMITES_TRIBUNA);

  /* --- estructura escalonada de cada sección --- *
   * Un bloque por fila, desde el suelo hasta la altura de esa fila: da el
   * mismo perfil de peldaños que las graderías de hormigón, y es además la
   * superficie que se clica.
   */
  const matEstructura = new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.92 });
  const matMuro = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.95 });
  const matCoping = new THREE.MeshStandardMaterial({ color: 0x8e9298, roughness: 0.8 });
  const plataformas = [];

  for (let i = 0; i < T.secciones.length; i++) {
    const peldanos = [];
    for (let f = 0; f < T.filas; f++) {
      const alto = alturaFila(f);
      const g = new THREE.BoxGeometry(T.fondo, alto, ANCHO_SECCION + 0.5);
      g.translate(T.xFrente - (f + 0.5) * T.fondo, alto / 2, 0);
      peldanos.push(g);
    }

    const seccion = new THREE.Mesh(mergeGeometries(peldanos, false), matEstructura);
    seccion.position.z = bordeSeccion(i) - ANCHO_SECCION / 2;
    seccion.castShadow = true;
    seccion.receiveShadow = true;
    seccion.name = 'tarima-sur';
    seccion.userData.seccion = i;
    grupo.add(seccion);
    plataformas.push(seccion);

    /* --- muro frontal: el mismo antepecho que remata la grada --- */
    const muro = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, T.foso, ANCHO_SECCION + 0.7),
      matMuro
    );
    muro.position.set(
      T.xFrente + 0.2, T.foso / 2, bordeSeccion(i) - ANCHO_SECCION / 2
    );
    muro.castShadow = true;
    muro.receiveShadow = true;
    muro.raycast = () => {};
    grupo.add(muro);

    // coronación, para que el borde se lea desde el campo
    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.18, ANCHO_SECCION + 0.8),
      matCoping
    );
    coping.position.set(
      T.xFrente + 0.2, T.foso + 0.09, bordeSeccion(i) - ANCHO_SECCION / 2
    );
    coping.raycast = () => {};
    grupo.add(coping);
  }

  /* --- butacas: una sola malla instanciada para las 2520 --- */
  const butacas = new THREE.InstancedMesh(
    geometriaButaca(),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    AFORO_TRIBUNA
  );
  butacas.name = 'butacas-sur';
  butacas.castShadow = false;
  butacas.receiveShadow = true;
  butacas.raycast = () => {};                   // se clica la tarima, no la butaca

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const asientos = [];                          // para sentar público encima
  let n = 0;

  for (let s = 0; s < T.secciones.length; s++) {
    for (let f = 0; f < T.filas; f++) {
      for (let col = 0; col < T.columnas; col++) {
        const p = posicionButaca(s, f, col);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        butacas.setMatrixAt(n, dummy.matrix);

        const [r, v, a] = mosaico.colorEn(p.x, p.z);
        color.setRGB(r, v, a, THREE.SRGBColorSpace);
        butacas.setColorAt(n, color);
        n++;

        asientos.push({ x: p.x, y: p.y + 0.34, z: p.z, nx: 1, nz: 0 });
      }
    }
  }
  butacas.instanceMatrix.needsUpdate = true;
  grupo.add(butacas);

  scene.add(grupo);

  return {
    grupo,
    plataformas,
    asientos,
    aforo: AFORO_TRIBUNA,
    aforoSeccion: AFORO_SECCION,
    alturaTotal: ALTURA_TOTAL,
    setButacasVisible: (v) => { butacas.visible = v; },
    setVisible: (v) => { grupo.visible = v; },
  };
}
