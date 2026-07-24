import * as THREE from 'three';
import { calidad, crearRegulador } from './perf.js';

export const scene = new THREE.Scene();

export const renderer = new THREE.WebGLRenderer({
  antialias: calidad.antialias,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = calidad.sombras;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;      // el sol no se mueve: una sola pasada
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

export const regulador = crearRegulador(renderer);

export const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 2000);
camera.position.set(140, 105, 180);

/* ---------- Cielo en degradado ---------- */
const cielo = new THREE.Mesh(
  new THREE.SphereGeometry(1200, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      arriba: { value: new THREE.Color(0x4f86c6) },
      abajo:  { value: new THREE.Color(0xd6e0e8) },
    },
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 arriba, abajo;
      varying vec3 vP;
      void main() {
        float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(abajo, arriba, pow(h, 0.8)), 1.0);
      }`,
  })
);
cielo.frustumCulled = false;
scene.add(cielo);

scene.fog = new THREE.FogExp2(0xc6d3dd, 0.00085);

/* ---------- Iluminación ---------- */
scene.add(new THREE.HemisphereLight(0xc4d8ef, 0x53584c, 1.15));

const sol = new THREE.DirectionalLight(0xfff2de, 2.1);
sol.position.set(-150, 200, 120);
sol.castShadow = calidad.sombras;
sol.shadow.mapSize.set(calidad.perfil === 'alto' ? 2048 : 1024, calidad.perfil === 'alto' ? 2048 : 1024);
Object.assign(sol.shadow.camera, {
  left: -190, right: 190, top: 190, bottom: -190, near: 1, far: 600,
});
sol.shadow.bias = -0.0008;
sol.shadow.camera.updateProjectionMatrix();
scene.add(sol);

scene.add(new THREE.AmbientLight(0xffffff, 0.2));

/** Fuerza una repasada del mapa de sombras (tras cambiar la escena). */
export function refrescarSombras() {
  if (calidad.sombras) renderer.shadowMap.needsUpdate = true;
}

/* ---------- Bucle ---------- */
const tareas = [];
/** Registra una función que se ejecuta en cada fotograma: fn(dt, t). */
export const onUpdate = (fn) => tareas.push(fn);

const reloj = new THREE.Clock();
let pausado = false;

export function start() {
  refrescarSombras();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (pausado) return;

    const t = reloj.elapsedTime;
    for (const fn of tareas) fn(dt, t);

    cielo.position.copy(camera.position);
    renderer.render(scene, camera);
    regulador.medir(dt);
  });
}

/* La pestaña oculta no dibuja: rAF ya se frena, pero así tampoco simulamos. */
document.addEventListener('visibilitychange', () => {
  pausado = document.hidden;
  if (!pausado) reloj.getDelta();      // descarta el salto de tiempo acumulado
});

/* ---------- Redimensionado con rebote ---------- */
let temporizador;
addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    refrescarSombras();
  }, 120);
});
