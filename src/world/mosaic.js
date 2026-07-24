/**
 * Mosaico de la tribuna: dibuja la bandera de Corea sobre un lienzo en
 * coordenadas del mundo y permite muestrear el color que corresponde a cada
 * butaca según su posición.
 *
 * Se dibuja en metros —no en celdas— para que el taeguk salga redondo en el
 * suelo, aunque la retícula de butacas no sea cuadrada.
 */

const ROJO   = '#cd2e3a';
const AZUL   = '#0047a0';
const NEGRO  = '#111318';
const BLANCO = '#eef0f2';

/** Los cuatro trigramas, de arriba abajo en cada esquina. */
const TRIGRAMAS = {
  geon: [1, 1, 1],        // ☰ cielo
  ri:   [1, 0, 1],        // ☲ fuego
  gam:  [0, 1, 0],        // ☵ agua
  gon:  [0, 0, 0],        // ☷ tierra
};

export function crearMosaico({ xMin, xMax, zMin, zMax, px = 8 }) {
  const ancho = zMax - zMin;      // el lado largo va en z
  const fondo = xMax - xMin;

  const c = document.createElement('canvas');
  c.width = Math.round(ancho * px);
  c.height = Math.round(fondo * px);
  const g = c.getContext('2d', { willReadFrequently: true });

  // mundo → lienzo: z crece hacia la izquierda, x hacia abajo
  const aPx = (x, z) => [(zMax - z) * px, (xMax - x) * px];
  const m = (metros) => metros * px;

  g.fillStyle = BLANCO;
  g.fillRect(0, 0, c.width, c.height);

  /* ---------- Taeguk ---------- */
  const cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
  const r = fondo * 0.26;                       // radio en metros: cabe en la sección C
  const [px0, py0] = aPx(cx, cz);
  const inclinacion = -Math.PI / 6;             // el eje del taeguk va inclinado

  g.save();
  g.translate(px0, py0);
  g.rotate(inclinacion);

  g.fillStyle = ROJO;                           // mitad superior
  g.beginPath(); g.arc(0, 0, m(r), Math.PI, 0); g.fill();
  g.fillStyle = AZUL;                           // mitad inferior
  g.beginPath(); g.arc(0, 0, m(r), 0, Math.PI); g.fill();

  g.fillStyle = ROJO;                           // lóbulos que forman la ese
  g.beginPath(); g.arc(-m(r) / 2, 0, m(r) / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = AZUL;
  g.beginPath(); g.arc(m(r) / 2, 0, m(r) / 2, 0, Math.PI * 2); g.fill();
  g.restore();

  /* ---------- Trigramas ---------- *
   * Uno en cada esquina, con las barras perpendiculares a la línea que une
   * la esquina con el centro de la bandera.
   */
  const zTri = ancho * 0.205;
  const xTri = fondo * 0.25;
  const esquinas = [
    { dz: +zTri, dx: +xTri, barras: TRIGRAMAS.geon },
    { dz: +zTri, dx: -xTri, barras: TRIGRAMAS.ri },
    { dz: -zTri, dx: +xTri, barras: TRIGRAMAS.gam },
    { dz: -zTri, dx: -xTri, barras: TRIGRAMAS.gon },
  ];

  const largo = r * 1.5, grueso = r * 0.26, hueco = r * 0.13;
  const corte = largo * 0.14;                   // separación de la barra partida

  for (const e of esquinas) {
    const [ex, ey] = aPx(cx + e.dx, cz + e.dz);
    const ang = Math.atan2(-e.dx, e.dz);        // dirección hacia el centro

    g.save();
    g.translate(ex, ey);
    g.rotate(ang);
    g.fillStyle = NEGRO;

    e.barras.forEach((entera, i) => {
      const offset = (i - 1) * m(grueso + hueco);
      if (entera) {
        g.fillRect(-m(largo) / 2, offset - m(grueso) / 2, m(largo), m(grueso));
      } else {
        const mitad = (m(largo) - m(corte)) / 2;
        g.fillRect(-m(largo) / 2, offset - m(grueso) / 2, mitad, m(grueso));
        g.fillRect(m(corte) / 2, offset - m(grueso) / 2, mitad, m(grueso));
      }
    });
    g.restore();
  }

  /* ---------- Muestreo ---------- */
  const datos = g.getImageData(0, 0, c.width, c.height).data;

  /** Color RGB (0-1) del mosaico en un punto del mundo. */
  function colorEn(x, z) {
    const [fx, fy] = aPx(x, z);
    const ix = Math.min(c.width - 1, Math.max(0, Math.round(fx)));
    const iy = Math.min(c.height - 1, Math.max(0, Math.round(fy)));
    const i = (iy * c.width + ix) * 4;
    return [datos[i] / 255, datos[i + 1] / 255, datos[i + 2] / 255];
  }

  return { colorEn, lienzo: c };
}
