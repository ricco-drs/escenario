import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { camera, renderer, onUpdate } from './scene.js';
import { Y_TOP, D_TOP, R, CONCIERTO } from '../config.js';

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 3;
controls.maxDistance = 620;
controls.target.set(0, 4, 0);

/* Vistas predefinidas: [posición, punto de mira] */
export const VISTAS = {
  aerea:   { pos: [140, 105, 180],                    tgt: [0, 3, 0] },
  dron:    { pos: [-40, 62, -150],                    tgt: [0, 2, 10] },
  tribuna: { pos: [-14, Y_TOP - 1, -(R + D_TOP - 5)], tgt: [0, 2, 0] },
  cancha:  { pos: [0, 1.75, 12],                      tgt: [0, 1.7, -8] },
  arco:    { pos: [74, 3.5, 0],                       tgt: [40, 2, 0] },
  // frente al escenario, a la altura de alguien de pie en el campo
  escenario: {
    pos: [CONCIERTO.escenario.x + 38, 1.7, 0],
    tgt: [CONCIERTO.escenario.x, 5, 0],
  },
};

let vuelo = null, tVuelo = 0;
let orbitando = true;
let velocidadOrbita = 0.045;

const V3 = (v) => (v instanceof THREE.Vector3 ? v.clone() : new THREE.Vector3(...v));

/** Anima la cámara hasta una posición y un punto de mira. */
export function volarA(pos, tgt, { duracion = 1.2, detenerOrbita = true, alLlegar } = {}) {
  vuelo = {
    from: camera.position.clone(),
    to: V3(pos),
    tf: controls.target.clone(),
    tt: V3(tgt),
    dur: duracion,
    alLlegar,
  };
  tVuelo = 0;
  if (detenerOrbita) orbitando = false;
}

/* ---------- Primera persona (mirador) ---------- *
 * Ancla la cámara en un punto fijo (el ojo del espectador) y sólo permite
 * girar la mirada, como estar sentado de verdad. Se sale con salirMirador().
 */
const mirador = { activo: false, yaw: 0, pitch: 0 };
const ojo = new THREE.Vector3();
const dir = new THREE.Vector3();
const SENS = 0.0045;                 // radianes por píxel arrastrado
const PITCH_MAX = 1.35;              // ~77°, para no volcar la vista

export const enMirador = () => mirador.activo;

function orientarDesde(punto, mira) {
  const v = V3(mira).sub(punto).normalize();
  mirador.yaw = Math.atan2(v.x, v.z);
  mirador.pitch = Math.asin(THREE.MathUtils.clamp(v.y, -1, 1));
}

/** Entra en primera persona: cámara fija en `punto`, mirando a `mira`. */
export function entrarMirador(punto, mira) {
  ojo.copy(V3(punto));
  orientarDesde(ojo, mira);
  mirador.activo = true;
  orbitando = false;
  controls.enabled = false;
  vuelo = null;
}

/** Sale de primera persona y devuelve el control de órbita. */
export function salirMirador() {
  if (!mirador.activo) return;
  mirador.activo = false;
  controls.enabled = true;
  // deja el objetivo de órbita ~10 m delante, para que la órbita sea natural
  dir.set(Math.sin(mirador.yaw) * Math.cos(mirador.pitch),
          Math.sin(mirador.pitch),
          Math.cos(mirador.yaw) * Math.cos(mirador.pitch));
  controls.target.copy(camera.position).addScaledVector(dir, 10);
}

function aplicarMirador() {
  mirador.pitch = THREE.MathUtils.clamp(mirador.pitch, -PITCH_MAX, PITCH_MAX);
  dir.set(Math.sin(mirador.yaw) * Math.cos(mirador.pitch),
          Math.sin(mirador.pitch),
          Math.cos(mirador.yaw) * Math.cos(mirador.pitch));
  camera.position.copy(ojo);
  camera.lookAt(ojo.x + dir.x, ojo.y + dir.y, ojo.z + dir.z);
}

/* Arrastre en primera persona: gira la mirada alrededor del punto fijo. */
let arrastrando = false, lx = 0, ly = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!mirador.activo) return;
  arrastrando = true; lx = e.clientX; ly = e.clientY;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!mirador.activo || !arrastrando) return;
  mirador.yaw += (e.clientX - lx) * SENS;
  mirador.pitch -= (e.clientY - ly) * SENS;
  lx = e.clientX; ly = e.clientY;
});
addEventListener('pointerup', () => { arrastrando = false; });

export function irAVista(nombre) {
  const v = VISTAS[nombre];
  if (!v) return;
  volarA(v.pos, v.tgt, { detenerOrbita: nombre !== 'aerea' });
}

export const setOrbita = (v) => { orbitando = v; };
export const getOrbita = () => orbitando;

/* ---------- Empuje manual (pad de flechas) ---------- *
 * Orbita la cámara alrededor del punto de mira, como arrastrar en PC.
 * `empuje` guarda la dirección mantenida: az = izquierda/derecha,
 * pol = arriba/abajo. La velocidad es en radianes por segundo.
 */
const empuje = { az: 0, pol: 0 };
const VEL_EMPUJE = 1.4;
const esferica = new THREE.Spherical();
const rel = new THREE.Vector3();

export function setEmpuje(az, pol) {
  empuje.az = az;
  empuje.pol = pol;
  if (az || pol) orbitando = false;      // el usuario toma el control
}

function empujarMirador(dt) {
  // en primera persona las flechas giran la mirada: der. = mirar a la derecha
  mirador.yaw -= empuje.az * VEL_EMPUJE * dt;
  mirador.pitch += empuje.pol * VEL_EMPUJE * dt;
}

function aplicarEmpuje(dt) {
  rel.copy(camera.position).sub(controls.target);
  esferica.setFromVector3(rel);
  esferica.theta -= empuje.az * VEL_EMPUJE * dt;
  esferica.phi -= empuje.pol * VEL_EMPUJE * dt;
  // no dejar que cruce los polos
  const EPS = 0.12;
  esferica.phi = Math.max(EPS, Math.min(Math.PI / 2 - 0.02, esferica.phi));
  rel.setFromSpherical(esferica);
  camera.position.copy(controls.target).add(rel);
  camera.lookAt(controls.target);
}

const easeInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2);

onUpdate((dt) => {
  if (vuelo) {
    tVuelo = Math.min(1, tVuelo + dt / vuelo.dur);
    const e = easeInOut(tVuelo);
    camera.position.lerpVectors(vuelo.from, vuelo.to, e);
    controls.target.lerpVectors(vuelo.tf, vuelo.tt, e);
    if (tVuelo >= 1) { const cb = vuelo.alLlegar; vuelo = null; cb?.(); }
    controls.update();
    return;
  }

  if (mirador.activo) {
    if (empuje.az || empuje.pol) empujarMirador(dt);
    aplicarMirador();
    return;                              // órbita desactivada mientras estás sentado
  }

  if (empuje.az || empuje.pol) {
    aplicarEmpuje(dt);
  } else if (orbitando) {
    const r = Math.hypot(camera.position.x, camera.position.z);
    const a = Math.atan2(camera.position.z, camera.position.x) + dt * velocidadOrbita;
    camera.position.x = Math.cos(a) * r;
    camera.position.z = Math.sin(a) * r;
    camera.lookAt(controls.target);
  }
  controls.update();
});

/* Cualquier interacción manual cancela la órbita automática. */
controls.addEventListener('start', () => { orbitando = false; });
