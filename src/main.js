import * as THREE from 'three';
import { start, refrescarSombras } from './core/scene.js';
import { volarA } from './core/cameraRig.js';
import { ovalAt } from './geometry/oval.js';

import { crearSuperficie } from './world/ground.js';
import { crearGraderias } from './world/stands.js';
import { crearDetalles } from './world/details.js';
import { crearRotulos } from './world/labels.js';
import { construirPlazas, aforoPorSeccion } from './world/seating.js';
import { crearPublico } from './world/crowd.js';
import { crearButacas } from './world/seats.js';
import {
  crearConcierto, posicionesCampo, aforoCampo,
  enCampo, enPasillo, zonaDeCampo,
} from './world/concert.js';
import { crearEscenario } from './world/stage.js';

import {
  crearTribunaSur, localidadEnPunto as localidadSur,
  posicionButaca, AFORO_SECCION,
} from './world/southStand.js';

import { crearSelectorAsiento } from './interaction/seatPicker.js';
import { crearInterfaz } from './ui/panel.js';
import { crearDpad } from './ui/dpad.js';

import { CONCIERTO, LIMITES, TRIBUNA_SUR, D0, D_TOP, Y_TOP } from './config.js';

/* ---------- Recinto ---------- */
crearSuperficie();
const { clicables } = crearGraderias();
const detalles = crearDetalles();
const rotulos = crearRotulos();

/* ---------- Localidades de grada ---------- */
const plazas = construirPlazas();
const butacas = crearButacas(plazas);
const publico = crearPublico(plazas);
const { porBloque, porGrupo } = aforoPorSeccion();

/* ---------- Tribuna Sur, a ras de campo ---------- */
const tribunaSur = crearTribunaSur();
const publicoSur = crearPublico(tribunaSur.asientos);

/* ---------- Montaje de concierto ---------- */
const concierto = crearConcierto();

// escenario BTS (modelo 3D): al cargar, retira la maqueta procedural
const escenario = crearEscenario({
  onReady: (e) => { if (e.cargado) concierto.ocultarEstructura(); },
});

const plazasCampo = posicionesCampo();
const publicoCampo = crearPublico(plazasCampo, { dePie: true, salto: 2.4 });
const campoPorZona = aforoCampo(plazasCampo);

/* ---------- Interacción ---------- */
const AFORO_INICIAL = 0;      // estadio vacío: el aforo se sube desde el panel
const FOCO_ESCENARIO = new THREE.Vector3(CONCIERTO.escenario.x, 4, 0);

// Vista única: el estadio con el escenario montado (sin modo concierto).
const modo = 'estadio';
let ui;

const selector = crearSelectorAsiento(
  [...clicables, concierto.campo, ...tribunaSur.plataformas], {
  onSelect: (sel) => ui.mostrarUbicacion(sel),
  onClear:  () => ui.ocultarUbicacion(),
  getFoco:  () => (modo === 'concierto' ? FOCO_ESCENARIO.clone() : null),

  /** Un clic en la tribuna Sur devuelve sección, fila y butaca. */
  resolverTribuna(p) {
    const loc = localidadSur(p.x, p.z);
    if (!loc) return null;
    return {
      tipo: 'tribuna-sur',
      ...loc,
      aforoSeccion: AFORO_SECCION,
      mirarA: modo === 'concierto'
        ? FOCO_ESCENARIO.clone()
        : new THREE.Vector3(0, 2, 0),
    };
  },

  /** Un clic en el campo devuelve la zona de acceso y un sitio de pie. */
  resolverCampo(p) {
    if (modo !== 'concierto') return null;
    if (!enCampo(p.x, p.z) || enPasillo(p.x, p.z)) return null;

    const zona = zonaDeCampo(p.x, p.z);
    return {
      tipo: 'campo',
      dePie: true,
      zona,
      x: p.x, y: 0.1, z: p.z,
      distancia: Math.hypot(p.x - CONCIERTO.escenario.x, p.z),
      aforoZona: campoPorZona.get(zona.id) ?? 0,
      mirarA: FOCO_ESCENARIO.clone(),
    };
  },
});

/* ---------- Montaje de la escena ---------- *
 * El escenario está siempre en el campo; el resto es el estadio normal. */
concierto.setVisible(false);   // maqueta procedural y decorado de concierto ocultos
escenario.setVisible(true);    // el modelo BTS, siempre visible
rotulos.setCampoVisible(false);
detalles.visible = true;       // porterías y banderines del estadio
refrescarSombras();

/** Lleva la cámara frente a una escalera de límite. */
function irALimite(id) {
  const l = LIMITES.find((x) => x.id === id);
  if (!l) return;
  selector.limpiar();
  const mira = ovalAt(l.s, D0 + 6);
  const ojo = ovalAt(l.s - l.cierre * 9, D_TOP + 26);
  volarA([ojo.x, Y_TOP + 17, ojo.z], [mira.x, 4, mira.z], { duracion: 1.4 });
}

/** Sienta la cámara en una butaca central de una sección de la tribuna Sur. */
function irATribunaSur(seccion) {
  const loc = {
    tipo: 'tribuna-sur',
    seccion,
    letra: TRIBUNA_SUR.secciones[seccion],
    fila: Math.floor(TRIBUNA_SUR.filas / 2),
    columna: Math.floor(TRIBUNA_SUR.columnas / 2),
    aforoSeccion: AFORO_SECCION,
    mirarA: modo === 'concierto'
      ? FOCO_ESCENARIO.clone()
      : new THREE.Vector3(0, 2, 0),
  };
  Object.assign(loc, posicionButaca(seccion, loc.fila, loc.columna));
  selector.situar(loc);
}

ui = crearInterfaz({
  publico, publicoCampo, publicoSur, selector, rotulos, irALimite,
  tribunaSur, irATribunaSur, butacas,
  aforoInicial: AFORO_INICIAL,
  aforo: { porBloque, porGrupo, campoPorZona },
});

crearDpad();

/* ---------- Arranque ---------- */
start();

requestAnimationFrame(() => requestAnimationFrame(() => {
  const carga = document.getElementById('carga');
  carga?.classList.add('fuera');
  carga?.addEventListener('transitionend', () => carga.remove(), { once: true });
}));
