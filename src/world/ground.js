import * as THREE from 'three';
import { scene, renderer } from '../core/scene.js';
import { calidad } from '../core/perf.js';
import { ovalAt } from '../geometry/oval.js';
import { PERIM, LANE, N_LANES, CANCHA, COLOR } from '../config.js';

/**
 * Pista y cancha se dibujan en un único canvas cenital y se proyectan
 * sobre un plano. Así el marcado sale nítido y sin geometría extra.
 */

const PX = calidad.texturaPX;   // píxeles por metro, según el dispositivo
const W = 250, H = 178;         // metros cubiertos por el plano

function texturaSuperficie() {
  const c = document.createElement('canvas');
  c.width = W * PX; c.height = H * PX;
  const g = c.getContext('2d');
  const P = (x, z) => [(x + W / 2) * PX, (z + H / 2) * PX];

  const trazo = (d, pasos = 900) => {
    g.beginPath();
    for (let i = 0; i <= pasos; i++) {
      const p = ovalAt((i / pasos) * PERIM, d);
      const [px, py] = P(p.x, p.z);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };

  /* --- explanada exterior de hormigón --- */
  g.fillStyle = '#6d7168';
  g.fillRect(0, 0, c.width, c.height);

  /* --- anillo perimetral --- */
  trazo(N_LANES * LANE + 3.0); g.fillStyle = '#7d8177'; g.fill();

  /* --- pista de tartán, ya envejecida --- */
  trazo(N_LANES * LANE + 0.5);
  g.fillStyle = '#' + COLOR.pista.toString(16).padStart(6, '0');
  g.fill();

  g.save();
  trazo(N_LANES * LANE + 0.5); g.clip();
  const grano = PX * PX * 300;                // se escala con la resolución
  for (let i = 0; i < grano; i++) {           // grano del tartán
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.10})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3);
  }
  for (let i = 0; i < 90; i++) {              // manchas de desgaste
    g.fillStyle = `rgba(210,190,170,${0.05 + Math.random() * 0.09})`;
    g.beginPath();
    g.ellipse(Math.random() * c.width, Math.random() * c.height,
              40 + Math.random() * 130, 30 + Math.random() * 90,
              Math.random() * 3, 0, 7);
    g.fill();
  }
  g.restore();

  /* --- líneas de carril --- */
  g.strokeStyle = 'rgba(238,238,232,.88)';
  g.lineWidth = 0.05 * PX * 2;
  for (let k = 0; k <= N_LANES; k++) { trazo(k * LANE); g.stroke(); }

  /* --- césped --- */
  trazo(-1.0); g.fillStyle = '#3f7a35'; g.fill();
  g.save(); trazo(-1.0); g.clip();
  for (let i = -10; i < 10; i++) {                       // franjas de corte
    g.fillStyle = i % 2 ? '#3d7633' : '#47883b';
    const [x0, y0] = P(i * 7, -H / 2);
    g.fillRect(x0, y0, 7 * PX, H * PX);
  }
  for (let i = 0; i < 40; i++) {                         // desgaste del césped
    g.fillStyle = `rgba(120,130,80,${0.04 + Math.random() * 0.06})`;
    g.beginPath();
    g.ellipse(Math.random() * c.width, Math.random() * c.height,
              50 + Math.random() * 140, 40 + Math.random() * 90, 0, 0, 7);
    g.fill();
  }
  g.restore();

  /* --- marcado reglamentario --- */
  const { largo: L, ancho: Wd } = CANCHA;
  g.strokeStyle = '#f2f5f0'; g.lineWidth = 0.12 * PX; g.fillStyle = '#f2f5f0';

  const rect = (x, z, w, h) => { const [a, b] = P(x, z); g.strokeRect(a, b, w * PX, h * PX); };
  const linea = (x1, z1, x2, z2) => {
    g.beginPath(); g.moveTo(...P(x1, z1)); g.lineTo(...P(x2, z2)); g.stroke();
  };
  const arco = (x, z, r, a0, a1) => {
    const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, r * PX, a0, a1); g.stroke();
  };
  const punto = (x, z) => {
    const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, 0.2 * PX, 0, 7); g.fill();
  };

  rect(-L / 2, -Wd / 2, L, Wd);
  linea(0, -Wd / 2, 0, Wd / 2);
  arco(0, 0, 9.15, 0, Math.PI * 2);
  punto(0, 0);

  for (const s of [-1, 1]) {
    rect(s > 0 ? L / 2 - 16.5 : -L / 2, -20.16, 16.5, 40.32);   // área grande
    rect(s > 0 ? L / 2 - 5.5 : -L / 2, -9.16, 5.5, 18.32);      // área chica
    const cx = s * (L / 2 - 11);
    punto(cx, 0);                                               // punto de penal
    if (s > 0) arco(cx, 0, 9.15, Math.PI * 0.72, Math.PI * 1.28);
    else       arco(cx, 0, 9.15, -Math.PI * 0.28, Math.PI * 0.28);
    for (const t of [-1, 1]) arco(s * L / 2, t * Wd / 2, 1, 0, Math.PI * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function crearSuperficie() {
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: texturaSuperficie(), roughness: 0.95 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  suelo.name = 'superficie';
  scene.add(suelo);

  const entorno = new THREE.Mesh(
    new THREE.CircleGeometry(800, 64),
    new THREE.MeshStandardMaterial({ color: 0x5a6053, roughness: 1 })
  );
  entorno.rotation.x = -Math.PI / 2;
  entorno.position.y = -0.08;
  entorno.receiveShadow = true;
  scene.add(entorno);

  return suelo;
}
