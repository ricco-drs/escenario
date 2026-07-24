import * as THREE from 'three';
import { scene, camera, renderer, onUpdate } from '../core/scene.js';
import { volarA } from '../core/cameraRig.js';
import { ovalInverse } from '../geometry/oval.js';
import { posicionAsiento, bloqueDeArco } from '../world/stands.js';
import {
  filaDesdeDistancia, plazaDesdeArco, arcoDePlaza, plazasEnFila,
} from '../world/seating.js';
import { BLOQUES, FILAS } from '../config.js';

const ALTURA_OJOS = 1.15;   // vista de alguien sentado

/**
 * Convierte un clic sobre la gradería en una localidad concreta
 * (sección, fila, asiento) y lleva la cámara a esa perspectiva.
 *
 * Si el punto cae en un tramo sin sección —escaleras o la cabecera Sur
 * descubierta— no ocurre nada: esas zonas no son vendibles.
 */
export function crearSelectorAsiento(
  objetivos, { onSelect, onClear, resolverCampo, resolverTribuna, getFoco } = {}
) {
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();

  /* --- marcador de la localidad elegida --- */
  const marcador = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.36, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffcf6a, side: THREE.DoubleSide,
      transparent: true, depthTest: false,
    })
  );
  marcador.rotation.x = -Math.PI / 2;
  marcador.visible = false;
  marcador.renderOrder = 999;
  marcador.raycast = () => {};
  scene.add(marcador);

  onUpdate((_, t) => {
    if (marcador.visible) marcador.scale.setScalar(1 + Math.sin(t * 3.4) * 0.12);
  });

  let seleccion = null;

  /** Construye la localidad a partir de bloque, fila y asiento. */
  function localidad(bloque, fila, plaza) {
    const s = arcoDePlaza(bloque, fila, plaza);
    return {
      tipo: 'grada',
      bloque, fila, plaza, s,
      totalFila: plazasEnFila(bloque, fila),
      ...posicionAsiento(fila, s),
    };
  }

  /** Resuelve un punto del mundo a una localidad, o `null` si no hay sección. */
  function localidadEnPunto(p) {
    const { s, d } = ovalInverse(p.x, p.z);
    const fila = filaDesdeDistancia(d);
    if (fila === null) return null;

    const bloque = bloqueDeArco(s);
    if (!bloque) return null;              // escalera o zona sin sección

    return localidad(bloque, fila, plazaDesdeArco(bloque, fila, s));
  }

  /** Coloca la cámara en una localidad (grada o campo). */
  function situar(sel) {
    seleccion = sel;
    marcador.position.set(sel.x, sel.y + 0.03, sel.z);
    marcador.visible = true;

    const altura = sel.dePie ? 1.65 : ALTURA_OJOS;
    const ojo = new THREE.Vector3(sel.x, sel.y + altura, sel.z);
    const foco = sel.mirarA ?? getFoco?.()
      ?? new THREE.Vector3(sel.x * 0.06, 1.2, sel.z * 0.06);
    volarA(ojo, foco, { duracion: 1.5 });

    onSelect?.(sel);
    return sel;
  }

  function limpiar() {
    seleccion = null;
    marcador.visible = false;
    onClear?.();
  }

  /* --- clic, ignorando los arrastres de la órbita --- */
  let inicio = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    inicio = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    inicio = null;
    if (movido > 5 || e.button !== 0) return;

    puntero.x = (e.clientX / innerWidth) * 2 - 1;
    puntero.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(puntero, camera);

    const hits = ray.intersectObjects(objetivos, true);
    if (!hits.length) return;

    const { object, point } = hits[0];

    if (object.name === 'campo' && resolverCampo) {
      const sel = resolverCampo(point);
      if (sel) situar(sel);
      return;
    }

    if (object.name === 'tarima-sur' && resolverTribuna) {
      const sel = resolverTribuna(point);
      if (sel) situar(sel);
      return;
    }

    const sel = localidadEnPunto(point);
    if (sel) situar(sel);
  });

  return {
    situar,
    limpiar,
    get seleccion() { return seleccion; },

    /** Localidad aleatoria dentro de un grupo (Occidente, Norte…). */
    aleatoria(grupoId) {
      const candidatos = grupoId
        ? BLOQUES.filter((b) => b.grupo === grupoId)
        : BLOQUES;
      if (!candidatos.length) return;

      const bloque = candidatos[(Math.random() * candidatos.length) | 0];
      const fila = (Math.random() * FILAS) | 0;
      const plaza = (Math.random() * plazasEnFila(bloque, fila)) | 0;
      return situar(localidad(bloque, fila, plaza));
    },

    /** Localidad concreta: útil para enlazar desde el mapa de secciones. */
    irABloque(bloqueId, fila = Math.floor(FILAS / 2)) {
      const bloque = BLOQUES.find((b) => b.id === bloqueId);
      if (!bloque) return;
      return situar(localidad(bloque, fila, Math.floor(plazasEnFila(bloque, fila) / 2)));
    },

    /** Sitio aleatorio de pie en el campo. */
    aleatoriaCampo() {
      if (!resolverCampo) return;
      for (let intento = 0; intento < 400; intento++) {
        const p = new THREE.Vector3(
          -46 + Math.random() * 92, 0, (Math.random() - 0.5) * 62
        );
        const sel = resolverCampo(p);
        if (sel) return situar(sel);
      }
    },
  };
}
