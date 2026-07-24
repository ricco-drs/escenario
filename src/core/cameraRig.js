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

/** Anima la cámara hasta una posición y un punto de mira. */
export function volarA(pos, tgt, { duracion = 1.2, detenerOrbita = true } = {}) {
  vuelo = {
    from: camera.position.clone(),
    to: pos instanceof THREE.Vector3 ? pos.clone() : new THREE.Vector3(...pos),
    tf: controls.target.clone(),
    tt: tgt instanceof THREE.Vector3 ? tgt.clone() : new THREE.Vector3(...tgt),
    dur: duracion,
  };
  tVuelo = 0;
  if (detenerOrbita) orbitando = false;
}

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
    if (tVuelo >= 1) vuelo = null;
  } else if (empuje.az || empuje.pol) {
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
