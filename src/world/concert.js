import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { CONCIERTO, COLOR } from '../config.js';

/**
 * Montaje de concierto según el mapa de localidades: escenario centrado en la
 * cancha y campo repartido en tres accesos por pasillos en aspa.
 *
 *        ╲   CAMPO A   ╱
 *          ╲ _______ ╱
 *   CAMPO C │ ESCEN. │ CAMPO B
 *          ╱ ‾‾‾‾‾‾‾ ╲
 *        ╱      │      ╲
 *      C     (línea)     B
 */

const { escenario: ESC, campo: C, pasillo: W_PAS, brazo: LARGO_BRAZO } = CONCIERTO;
const ANG_BRAZOS = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];

/* ---------- Contorno del campo ---------- */
function formaCampo() {
  const f = new THREE.Shape();
  const zh = C.ancho / 2, r = C.radio;
  f.moveTo(C.xMin + r, -zh);
  f.lineTo(C.xMax - r, -zh);
  f.quadraticCurveTo(C.xMax, -zh, C.xMax, -zh + r);
  f.lineTo(C.xMax, zh - r);
  f.quadraticCurveTo(C.xMax, zh, C.xMax - r, zh);
  f.lineTo(C.xMin + r, zh);
  f.quadraticCurveTo(C.xMin, zh, C.xMin, zh - r);
  f.lineTo(C.xMin, -zh + r);
  f.quadraticCurveTo(C.xMin, -zh, C.xMin + r, -zh);
  return f;
}

/** ¿El punto está dentro del campo vendible? */
export function enCampo(x, z) {
  if (x < C.xMin || x > C.xMax || Math.abs(z) > C.ancho / 2) return false;
  const ex = (x - ESC.x) / (ESC.rx + 4), ez = z / (ESC.rz + 4);
  return ex * ex + ez * ez >= 1;         // fuera del escenario y su foso
}

/** ¿El punto cae sobre un pasillo de circulación? */
export function enPasillo(x, z) {
  const dx = x - ESC.x, dz = z;
  for (const ang of ANG_BRAZOS) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const a = dx * c + dz * s;           // avance a lo largo del brazo
    const t = -dx * s + dz * c;          // separación lateral
    if (a > 0 && a < LARGO_BRAZO && Math.abs(t) < W_PAS / 2) return true;
  }
  return false;
}

/**
 * Zona de campo de un punto.
 * A ocupa el sector superior entre las dos aspas altas; el resto se reparte
 * entre B (derecha) y C (izquierda) por la línea central.
 */
export function zonaDeCampo(x, z) {
  const [A, B, Cz] = CONCIERTO.zonas;
  const ang = Math.atan2(z, x - ESC.x);
  if (ang > Math.PI * 0.25 && ang < Math.PI * 0.75) return A;
  return x - ESC.x >= 0 ? B : Cz;
}

export function crearConcierto() {
  const grupo = new THREE.Group();
  grupo.name = 'concierto';

  /* Plano invisible del campo: sin color rojo ni aspas negras pintadas —
   * sólo sirve de superficie clicable para ubicarse de pie en el campo. */
  const campo = new THREE.Mesh(
    new THREE.ShapeGeometry(formaCampo(), 20),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  campo.rotation.x = -Math.PI / 2;
  campo.position.y = 0.07;
  campo.name = 'campo';
  grupo.add(campo);

  /* --- escenario procedural --- *
   * Maqueta sencilla que sirve de reserva mientras carga el modelo GLB, y
   * de sustituto si éste fallara. Se agrupa aparte para poder ocultarlo de
   * una vez cuando el modelo real está en escena.
   */
  const estructura = new THREE.Group();
  estructura.name = 'escenario-procedural';

  const tarima = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, ESC.alto, 40),
    new THREE.MeshStandardMaterial({ color: COLOR.escenario, roughness: 0.7 })
  );
  tarima.scale.set(ESC.rx, 1, ESC.rz);
  tarima.position.set(ESC.x, ESC.alto / 2, 0);
  tarima.castShadow = true;
  tarima.receiveShadow = true;
  tarima.name = 'escenario';
  estructura.add(tarima);

  const matNegro = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.65 });
  const portico = new THREE.Mesh(new THREE.BoxGeometry(ESC.rx * 1.7, 1.2, 1.2), matNegro);
  portico.position.set(ESC.x, 14, 0);
  portico.castShadow = true;
  estructura.add(portico);

  for (const z of [-1, 1]) {
    const torre = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14, 1.4), matNegro);
    torre.position.set(ESC.x, 7, z * ESC.rz * 0.82);
    torre.castShadow = true;
    estructura.add(torre);

    const pantalla = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5.6),
      new THREE.MeshBasicMaterial({ color: 0x2c5fbf })
    );
    pantalla.position.set(ESC.x + z * (ESC.rx - 1), 9, 0);
    pantalla.rotation.y = z * Math.PI / 2;
    estructura.add(pantalla);

    const pa = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 2), matNegro);
    pa.position.set(ESC.x + 22, 4.5, z * 24);
    pa.castShadow = true;
    estructura.add(pa);
  }
  grupo.add(estructura);

  /* --- valla perimetral del campo (sólo el borde) --- */
  {
    const puntos = formaCampo().getPoints(150);
    const ALTO = 1.15, pos = [], idx = [];
    puntos.forEach((p, i) => {
      pos.push(p.x, 0.07, p.y, p.x, ALTO, p.y);
      if (i < puntos.length - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const valla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2b2b30, roughness: 0.7, side: THREE.DoubleSide,
      transparent: true, opacity: 0.6,
    }));
    valla.raycast = () => {};
    grupo.add(valla);
  }

  grupo.visible = false;
  scene.add(grupo);

  return {
    grupo,
    campo,
    escenario: tarima,
    estructura,
    setVisible: (v) => { grupo.visible = v; },
    /** Oculta la maqueta cuando el modelo GLB ocupa su lugar. */
    ocultarEstructura: () => { estructura.visible = false; },
  };
}

/** Posiciones del público de pie en el campo. */
export function posicionesCampo() {
  const pos = [];
  const area = (C.xMax - C.xMin) * C.ancho;
  const objetivo = Math.floor(area * CONCIERTO.densidadCampo);

  for (let i = 0; pos.length < objetivo && i < objetivo * 6; i++) {
    const x = C.xMin + Math.random() * (C.xMax - C.xMin);
    const z = (Math.random() - 0.5) * C.ancho;
    if (!enCampo(x, z) || enPasillo(x, z)) continue;

    // más densidad cerca del escenario
    const dist = Math.hypot(x - ESC.x, z);
    if (Math.random() > 1 - dist / 150) continue;

    const dx = x - ESC.x;
    const n = Math.hypot(dx, z) || 1;
    pos.push({ x, y: 0.1, z, nx: dx / n, nz: z / n, zona: zonaDeCampo(x, z) });
  }
  return pos;
}

/** Aforo de cada zona de campo, a partir de la muestra generada. */
export function aforoCampo(posiciones) {
  const conteo = new Map(CONCIERTO.zonas.map((z) => [z.id, 0]));
  for (const p of posiciones) conteo.set(p.zona.id, conteo.get(p.zona.id) + 1);
  return conteo;
}
