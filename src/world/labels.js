import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { ovalAt } from '../geometry/oval.js';
import { BLOQUES, LIMITES, D_TOP, Y_TOP, CONCIERTO, TRIBUNA_SUR } from '../config.js';
import { posicionButaca } from './southStand.js';

/**
 * Rótulos flotantes: la letra de cada bloque sobre su gradería y el nombre
 * de cada acceso sobre el campo, igual que en el mapa de localidades.
 *
 * Todas las etiquetas comparten un único material por estilo y se dibujan
 * como sprites, así que se leen desde cualquier ángulo.
 */

function textura(texto, { fondo, color, ancho = 256, alto = 128, radio = 26 }) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const g = c.getContext('2d');

  g.fillStyle = fondo;
  g.beginPath();
  g.roundRect(4, 4, ancho - 8, alto - 8, radio);
  g.fill();

  g.strokeStyle = 'rgba(255,255,255,.25)';
  g.lineWidth = 3;
  g.stroke();

  g.fillStyle = color;
  g.font = `600 ${alto * 0.52}px ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, ancho / 2, alto / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sprite(texto, pos, escala, estilo) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textura(texto, estilo),
    depthTest: false,
    transparent: true,
  }));
  s.position.copy(pos);
  s.scale.set(escala.x, escala.y, 1);
  s.renderOrder = 900;
  return s;
}

export function crearRotulos() {
  const grupo = new THREE.Group();
  grupo.name = 'rotulos';

  /* --- letra de cada bloque, sobre la coronación --- */
  for (const b of BLOQUES) {
    const centro = (b.desde + b.hasta) / 2;
    const p = ovalAt(centro, D_TOP + 1.5);
    grupo.add(sprite(
      b.letra,
      new THREE.Vector3(p.x, Y_TOP + 4.2, p.z),
      { x: 3.6, y: 3.6 },
      { fondo: 'rgba(18,24,32,.86)', color: '#f1f5f9', ancho: 128, alto: 128, radio: 26 }
    ));
  }

  /* --- escaleras de límite, en ámbar para no confundirlas con las secciones --- */
  for (const l of LIMITES) {
    const p = ovalAt(l.s, D_TOP + 1.5);
    grupo.add(sprite(
      l.id,
      new THREE.Vector3(p.x, Y_TOP + 5.6, p.z),
      { x: 5.0, y: 3.4 },
      { fondo: 'rgba(122,68,10,.92)', color: '#ffd79a', ancho: 190, alto: 128, radio: 26 }
    ));
  }

  /* --- secciones de la tribuna Sur, a ras de campo --- */
  for (let i = 0; i < TRIBUNA_SUR.secciones.length; i++) {
    const p = posicionButaca(i, -1.6, TRIBUNA_SUR.columnas / 2);
    grupo.add(sprite(
      TRIBUNA_SUR.secciones[i],
      new THREE.Vector3(p.x, 3.4, p.z),
      { x: 3.4, y: 3.4 },
      { fondo: 'rgba(18,24,32,.86)', color: '#f1f5f9', ancho: 128, alto: 128, radio: 26 }
    ));
  }

  scene.add(grupo);

  /* --- accesos de campo: sólo visibles en modo concierto --- */
  const campo = new THREE.Group();
  campo.name = 'rotulos-campo';
  campo.visible = false;

  const ESC = CONCIERTO.escenario;
  const sitios = {
    CAMPO_A: [ESC.x, 26],
    CAMPO_B: [ESC.x + 32, 0],
    CAMPO_C: [ESC.x - 32, 0],
  };

  for (const zona of CONCIERTO.zonas) {
    const [x, z] = sitios[zona.id];
    campo.add(sprite(
      zona.nombre.replace('Campo ', ''),
      new THREE.Vector3(x, 6, z),
      { x: 15, y: 4.7 },
      { fondo: 'rgba(10,10,12,.82)', color: '#ffffff', ancho: 512, alto: 160, radio: 26 }
    ));
  }
  scene.add(campo);

  return {
    grupo,
    campo,
    setVisible: (v) => { grupo.visible = v; },
    setCampoVisible: (v) => { campo.visible = v; },
  };
}
