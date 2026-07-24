import { A, R, PERIM } from '../config.js';

/**
 * El estadio entero se construye sobre una única curva: el borde interior
 * de la pista (dos rectas unidas por dos semicírculos). Cualquier elemento
 * —grada, cubierta, muro— es esa curva desplazada `d` metros hacia afuera.
 *
 *      s = 0            s = 2A
 *      ┌──────── NORTE ───────┐
 *   OCC │                     │ ORI
 *      └──────── SUR ─────────┘
 */

const ARCO = Math.PI * R;

/** Punto y normal exterior de la curva base para el arco `s`. */
export function oval(s) {
  s = ((s % PERIM) + PERIM) % PERIM;

  if (s < 2 * A) {                       // recta norte (+z), hacia +x
    return { x: -A + s, z: R, nx: 0, nz: 1 };
  }
  s -= 2 * A;

  if (s < ARCO) {                        // curva oriente, centro (+A, 0)
    const a = Math.PI / 2 - s / R;
    return { x: A + R * Math.cos(a), z: R * Math.sin(a),
             nx: Math.cos(a), nz: Math.sin(a) };
  }
  s -= ARCO;

  if (s < 2 * A) {                       // recta sur (−z), hacia −x
    return { x: A - s, z: -R, nx: 0, nz: -1 };
  }
  s -= 2 * A;

  const a = -Math.PI / 2 - s / R;        // curva occidente, centro (−A, 0)
  return { x: -A + R * Math.cos(a), z: R * Math.sin(a),
           nx: Math.cos(a), nz: Math.sin(a) };
}

/** Punto de la curva desplazado `d` metros hacia afuera. */
export function ovalAt(s, d) {
  const o = oval(s);
  return { x: o.x + o.nx * d, z: o.z + o.nz * d };
}

/**
 * Inversa de `ovalAt`: dado un punto del mundo devuelve su arco `s`
 * y su distancia `d` a la curva base. Es lo que permite saber en qué
 * fila y asiento cayó un clic.
 */
export function ovalInverse(x, z) {
  if (Math.abs(x) <= A) {                          // zona de rectas
    return z >= 0
      ? { s: x + A,                    d: z - R }
      : { s: 2 * A + ARCO + (A - x),   d: -z - R };
  }

  if (x > A) {                                     // curva oriente
    const dx = x - A, a = Math.atan2(z, dx);
    return { s: 2 * A + R * (Math.PI / 2 - a), d: Math.hypot(dx, z) - R };
  }

  const dx = x + A;                                // curva occidente
  let a = Math.atan2(z, dx);
  if (a > 0) a -= 2 * Math.PI;                     // continuidad: (−3π/2, −π/2)
  return { s: 4 * A + ARCO + R * (-Math.PI / 2 - a), d: Math.hypot(dx, z) - R };
}

/** Perímetro real de una fila situada a distancia `d` de la curva base. */
export const perimetroFila = (d) => 4 * A + 2 * Math.PI * (R + d);

/** Distancia angular mínima entre dos arcos, respetando el cierre del óvalo. */
export function distanciaArco(s1, s2) {
  const d = Math.abs(((s1 - s2) % PERIM + PERIM) % PERIM);
  return Math.min(d, PERIM - d);
}
