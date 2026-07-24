import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, refrescarSombras } from '../core/scene.js';
import { ESCENARIO_MODELO as M } from '../config.js';

// Vite fingerprutea el modelo y lo sirve desde /assets con caché inmutable.
import modeloUrl from '../../escenario_bts_v1.glb?url';

/**
 * Carga el escenario BTS (GLB) y lo coloca en el centro del campo, a escala
 * real respecto al estadio. El modelo ya viene en metros, así que sólo se
 * reposiciona: base sobre el campo y centro en planta sobre el origen.
 *
 * La carga es asíncrona; `onReady` avisa cuando el modelo está en escena
 * (o si falló), para poder retirar la maqueta procedural sólo si hubo éxito.
 */
export function crearEscenario({ onReady } = {}) {
  const grupo = new THREE.Group();
  grupo.name = 'escenario-glb';
  grupo.visible = false;
  grupo.position.set(M.x, 0, M.z);
  grupo.rotation.y = M.giro;
  scene.add(grupo);

  // contenedor interior: aplica escala y apoyo, con el modelo ya recentrado
  const cont = new THREE.Group();
  cont.scale.setScalar(M.escala);
  cont.position.y = M.base;
  grupo.add(cont);

  const estado = { cargado: false, error: null, ancho: 0, alto: 0, fondo: 0 };

  new GLTFLoader().load(
    modeloUrl,
    (gltf) => {
      const modelo = gltf.scene;

      modelo.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;

        // los materiales LED / luces se hacen emisivos para que brillen
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const nombre = (m.name || '').toLowerCase();
          if (nombre.includes('led') || nombre.includes('luz')) {
            m.emissive = m.color.clone();
            m.emissiveIntensity = 1.4;
            m.toneMapped = false;
          }
        }
      });

      // recentrar: base al suelo (y=0 local), centro X/Z al origen del cont
      const caja = new THREE.Box3().setFromObject(modelo);
      const tam = new THREE.Vector3(); caja.getSize(tam);
      const centro = new THREE.Vector3(); caja.getCenter(centro);
      modelo.position.set(-centro.x, -caja.min.y, -centro.z);
      cont.add(modelo);

      estado.cargado = true;
      estado.ancho = tam.x * M.escala;
      estado.alto = tam.y * M.escala;
      estado.fondo = tam.z * M.escala;

      refrescarSombras();
      onReady?.(estado);
    },
    undefined,
    (err) => {
      estado.error = err;
      console.error('No se pudo cargar el escenario GLB:', err);
      onReady?.(estado);
    }
  );

  return {
    grupo,
    estado,
    setVisible: (v) => { grupo.visible = v; },
    setEscala: (s) => {
      cont.scale.setScalar(s);
      estado.ancho = (estado.ancho / M.escala) * s;   // referencia informativa
    },
    setGiro: (r) => { grupo.rotation.y = r; },
  };
}
