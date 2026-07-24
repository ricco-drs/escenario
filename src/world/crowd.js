import * as THREE from 'three';
import { scene, onUpdate } from '../core/scene.js';
import { calidad } from '../core/perf.js';

/**
 * Público dibujado con una única malla instanciada.
 *
 * Clave de rendimiento: las matrices se calculan **una sola vez** al construir.
 * El balanceo, el salto y el giro ocurren en el vertex shader a partir de un
 * atributo de fase por instancia, así que animar 45 000 personas no cuesta
 * nada de CPU. El aforo se ajusta moviendo `count`, que es gratis.
 */

const ROPA = [
  0xd9d9d5, 0x232b36, 0xa4262c, 0x2f5aa8,
  0xe0a53c, 0x3d7a46, 0x7a4a8c, 0x6b4630,
];

export function crearPublico(plazas, { dePie = false, salto = 1 } = {}) {
  // en dispositivos flojos se recorta la muestra en lugar de bajar el frame rate
  const total = Math.min(plazas.length, calidad.publicoMax);

  const geo = dePie
    ? new THREE.CapsuleGeometry(0.16, 0.80, 2, 5)
    : new THREE.CapsuleGeometry(0.16, 0.34, 2, 5);
  geo.translate(0, dePie ? 0.58 : 0.42, 0);

  /* --- orden de ocupación barajado (Fisher–Yates) --- *
   * Al bajar el aforo se recorta `count`, así que el barajado es lo que
   * hace que el estadio se vacíe disperso y no por bloques.
   */
  const orden = [...plazas.keys()];
  for (let i = orden.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }

  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const malla = new THREE.InstancedMesh(geo, material, total);
  malla.name = dePie ? 'publico-campo' : 'publico-grada';
  malla.frustumCulled = false;          // el anillo siempre cruza el encuadre
  malla.matrixAutoUpdate = false;

  /* --- matrices y colores, una única vez --- */
  const m = new THREE.Object3D();
  const c = new THREE.Color();
  const fases = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = plazas[orden[i]];
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(0, Math.atan2(p.nx, p.nz), 0);
    m.scale.setScalar(0.88 + Math.random() * 0.22);
    m.updateMatrix();
    malla.setMatrixAt(i, m.matrix);

    c.setHex(ROPA[(Math.random() * ROPA.length) | 0])
     .multiplyScalar(0.75 + Math.random() * 0.5);
    malla.setColorAt(i, c);

    fases[i] = Math.random() * Math.PI * 2;
  }
  malla.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aFase', new THREE.InstancedBufferAttribute(fases, 1));

  /* --- animación en GPU --- */
  const uniforms = { uTiempo: { value: 0 }, uSalto: { value: 0.13 * salto } };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTiempo = uniforms.uTiempo;
    shader.uniforms.uSalto = uniforms.uSalto;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        uniform float uTiempo;
        uniform float uSalto;
        attribute float aFase;
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        float onda = sin(uTiempo * 2.4 + aFase);
        transformed.y += max(0.0, onda) * uSalto;
        // ligero balanceo lateral, desfasado respecto al salto
        transformed.x += sin(uTiempo * 1.3 + aFase) * 0.03;
      `);
  };
  // instancias con la misma firma de shader comparten programa
  material.customProgramCacheKey = () => 'publico';

  scene.add(malla);

  let objetivo = 0, actual = 0;
  malla.count = 0;

  onUpdate((dt, t) => {
    uniforms.uTiempo.value = t;
    if (Math.abs(objetivo - actual) > 0.0005) {
      actual += (objetivo - actual) * Math.min(1, dt * 3);
      malla.count = Math.floor(total * actual);
    }
  });

  return {
    malla,
    total,
    /** Nº de localidades reales, aunque se dibuje una muestra menor. */
    capacidad: plazas.length,
    setAforo: (f) => { objetivo = f; },
    setVisible: (v) => { malla.visible = v; },
  };
}
