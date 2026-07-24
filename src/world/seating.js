import { D0, FILAS, HUELLA, PASO_ASIENTO, PERIM, BLOQUES, GRUPOS } from '../config.js';
import { ovalAt } from '../geometry/oval.js';
import { posicionAsiento } from './stands.js';

/**
 * Numeración de localidades: sección + fila + asiento, como en una entrada.
 *
 * Cada bloque numera sus asientos desde 1 en cada fila, así que el aforo sale
 * de la geometría real del bloque, no de un reparto global.
 */

const distanciaFila = (fila) => D0 + fila * HUELLA + 0.45;

/** Longitud real de una fila dentro de un bloque, midiéndola por muestreo. */
function longitudFila(bloque, fila) {
  const d = distanciaFila(fila);
  const N = 24;
  let largo = 0, prev = ovalAt(bloque.desde, d);
  for (let i = 1; i <= N; i++) {
    const s = bloque.desde + ((bloque.hasta - bloque.desde) * i) / N;
    const p = ovalAt(s, d);
    largo += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  return largo;
}

/** Nº de asientos de una fila de un bloque. */
export const plazasEnFila = (bloque, fila) =>
  Math.max(1, Math.floor(longitudFila(bloque, fila) / PASO_ASIENTO));

/** Arco del centro de un asiento. */
export function arcoDePlaza(bloque, fila, plaza) {
  const n = plazasEnFila(bloque, fila);
  return bloque.desde + ((plaza + 0.5) / n) * (bloque.hasta - bloque.desde);
}

/** Asiento más cercano a un arco dentro de un bloque. */
export function plazaDesdeArco(bloque, fila, s) {
  const n = plazasEnFila(bloque, fila);
  // si el bloque cruza el origen del arco, el punto va una vuelta por detrás
  const t = s < bloque.desde ? s + PERIM : s;
  const u = (t - bloque.desde) / (bloque.hasta - bloque.desde);
  return Math.min(n - 1, Math.max(0, Math.floor(u * n)));
}

/** Fila más cercana a una distancia `d` de la curva base (o null si cae fuera). */
export function filaDesdeDistancia(d) {
  const f = Math.round((d - D0 - 0.45) / HUELLA);
  return f >= 0 && f < FILAS ? f : null;
}

/** Todas las localidades del estadio. */
export function construirPlazas() {
  const plazas = [];
  for (const bloque of BLOQUES) {
    for (let fila = 0; fila < FILAS; fila++) {
      const n = plazasEnFila(bloque, fila);
      for (let k = 0; k < n; k++) {
        const s = arcoDePlaza(bloque, fila, k);
        plazas.push({ bloque, fila, plaza: k, s, ...posicionAsiento(fila, s) });
      }
    }
  }
  return plazas;
}

/** Aforo por bloque y por grupo, para el desglose de la interfaz. */
export function aforoPorSeccion() {
  const porBloque = new Map();
  const porGrupo = new Map(GRUPOS.map((g) => [g.id, 0]));

  for (const bloque of BLOQUES) {
    let n = 0;
    for (let fila = 0; fila < FILAS; fila++) n += plazasEnFila(bloque, fila);
    porBloque.set(bloque.id, n);
    porGrupo.set(bloque.grupo, porGrupo.get(bloque.grupo) + n);
  }
  return { porBloque, porGrupo };
}
