/**
 * Parámetros del estadio. Todo lo demás se deriva de aquí:
 * si cambias una medida, la geometría se regenera coherente.
 */

/* ---------- Pista de atletismo (medidas reglamentarias) ---------- */
export const A = 42.195;                 // media recta
export const R = 36.5;                   // radio de las curvas
export const PERIM = 4 * A + 2 * Math.PI * R;
export const LANE = 1.22;                // ancho de carril
export const N_LANES = 8;

const ARCO = Math.PI * R;                // longitud de cada semicírculo

/* ---------- Cancha ---------- */
export const CANCHA = { largo: 105, ancho: 68 };

/* ---------- Graderías ---------- *
 * Hormigón desnudo, sin butacas: peldaños corridos donde el público
 * se sienta directamente.
 */
export const D0     = N_LANES * LANE + 4.2;   // arranque tras la pista
export const FOSO   = 2.6;                    // muro frontal / foso
export const FILAS  = 24;                     // peldaños
export const HUELLA = 0.86;                   // profundidad de cada peldaño
export const CONTRA = 0.42;                   // altura de cada peldaño
export const D_TOP  = D0 + FILAS * HUELLA;
export const Y_TOP  = FOSO + FILAS * CONTRA;

/* ---------- Ocupación ---------- */
export const PASO_ASIENTO = 0.50;             // ancho asignado por espectador

/* ==========================================================================
 * LÍMITES
 *
 * Escaleras que marcan la frontera de la zona utilizable. Se declaran antes
 * que las secciones porque éstas se anclan a ellas.
 * ========================================================================== */

export const LIMITE = {
  ancho: 2.6,        // escalera de límite, más ancha que las de paso
  pretil: 1.15,      // altura del muro de cierre
  grosor: 0.26,
};

/**
 * El arco `s` se mide sobre la curva base, pero la grada está unos 24 m más
 * afuera: allí el mismo arco recorre 1.6 veces más distancia. Se convierte
 * para que las distancias se expresen en metros reales de gradería.
 */
const aArco = (metros) => metros * (R / (R + D0 + (FILAS * HUELLA) / 2));

/* Arcos de cada límite, reutilizables como anclaje de las secciones. */
export const S_L1 = 2 * A + aArco(18);
export const S_L2 = 2 * A + ARCO - aArco(28);
export const S_L3 = 4 * A + ARCO + aArco(18);
export const S_L4 = PERIM - aArco(18);

/**
 * Van numeradas L1…L4 en el sentido del arco, empezando por la curva Norte.
 * `cierre` indica hacia qué lado mira el pretil.
 *
 *            L1 ╮                 ╭ L4
 *          NORTE│  ← occidente →  │SUR
 *            L2 ╯                 ╰ L3
 */
export const LIMITES = [
  { id: 'L1', zona: 'Norte · lado Occidente', metros: 18, s: S_L1, cierre: +1 },
  { id: 'L2', zona: 'Norte · lado Oriente',   metros: 28, s: S_L2, cierre: -1 },
  { id: 'L3', zona: 'Sur · lado Oriente',     metros: 18, s: S_L3, cierre: +1 },
  { id: 'L4', zona: 'Sur · lado Occidente',   metros: 18, s: S_L4, cierre: -1 },
];

/* ==========================================================================
 * SECCIONES
 *
 * La gradería no es un anillo continuo: son bloques separados por escaleras,
 * tal cual el mapa de localidades. Lo que quede fuera de un grupo es hormigón
 * sin localidades: ni se vende, ni se puebla, ni se puede clicar.
 * ========================================================================== */

export const HUECO = 1.5;                     // arco ocupado por cada escalera
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * `invertir` numera el grupo en sentido contrario al arco.
 *
 * Hace falta porque el arco recorre el óvalo en un único sentido, mientras
 * que el mapa de localidades numera las dos rectas desde el mismo extremo:
 * la A de Occidente y la A de Oriente quedan enfrentadas, junto a la
 * cabecera Sur, y las últimas letras (M y L) junto a la curva Norte.
 */
/**
 * Grupos de secciones. Formato:
 *   { id, nombre, n, desde, hasta, color, invertir? }
 *
 * Referencia de arcos:
 *   recta 1: 0 … 2A            curva 1: 2A … 2A+ARCO
 *   recta 2: 2A+ARCO … 4A+ARCO curva 2: 4A+ARCO … PERIM
 *
 * La curva Norte va entera de límite a límite: la sección A arranca pegada a
 * L2 y la J muere contra L1. Como el arco avanza de L1 hacia L2, las letras
 * se numeran al revés (`invertir`).
 */
export const GRUPOS = [
  { id: 'NORTE', nombre: 'Norte', n: 10, invertir: true,
    desde: S_L1, hasta: S_L2, color: 0x9aa1a8 },

  // Recta de Oriente: de L4 a L1, con la A pegada a L4 y la L a L1. El tramo
  // cruza el origen del arco, por eso arranca en negativo.
  { id: 'ORIENTE', nombre: 'Oriente', n: 12,
    desde: S_L4 - PERIM, hasta: S_L1, color: 0xa7aeb5 },

  // Recta de Occidente: de L2 a L3, con la A pegada a L3 y la M a L2.
  // E, F y G son sensiblemente más estrechas que el resto.
  { id: 'OCCIDENTE', nombre: 'Occidente', n: 13, invertir: true,
    desde: S_L2, hasta: S_L3, color: 0x9aa1a8,
    // El hueco de escalera es fijo, así que resta más a las secciones
    // estrechas: con peso 0.66 el ancho útil queda en el 60% del de una grande.
    //      A  B  C  D    E     F     G    H  I  J  K  L  M
    pesos: [1, 1, 1, 1, 0.66, 0.66, 0.66, 1, 1, 1, 1, 1, 1] },
];

/**
 * Reparte un grupo en `n` bloques separados por huecos de escalera.
 *
 * Cada bloque se lleva al rango [0, PERIM) por su arranque. Un grupo que
 * cruce el origen del arco deja un bloque con `hasta` mayor que PERIM: es la
 * forma de decir «este bloque atraviesa la costura», y tanto la búsqueda de
 * bloque como la numeración de asientos lo tienen en cuenta.
 */
function repartir(grupo) {
  const n = grupo.n;
  // `pesos` da el ancho relativo de cada sección, en orden alfabético
  const pesos = grupo.pesos ?? Array(n).fill(1);
  const suma = pesos.reduce((a, b) => a + b, 0);
  const largo = grupo.hasta - grupo.desde;

  let cursor = grupo.desde;

  return Array.from({ length: n }, (_, i) => {
    const orden = grupo.invertir ? n - 1 - i : i;      // índice de la letra
    const letra = LETRAS[orden];
    const ancho = (pesos[orden] / suma) * largo;

    const desde = cursor + HUECO / 2;
    const hasta = cursor + ancho - HUECO / 2;
    cursor += ancho;

    const vuelta = Math.floor(desde / PERIM) * PERIM;
    return {
      id: `${grupo.id}-${letra}`,
      letra,
      grupo: grupo.id,
      nombreGrupo: grupo.nombre,
      desde: desde - vuelta,
      hasta: hasta - vuelta,
    };
  });
}

/** Todos los bloques vendibles, en orden de arco. */
export const BLOQUES = GRUPOS.flatMap(repartir);

/** Tramos sin sección: huecos de escalera y cabeceras descubiertas. */
export const HUECOS = (() => {
  // sin bloques definidos, el anillo entero es gradería sin localidades
  if (!BLOQUES.length) return [{ desde: 0, hasta: PERIM }];

  const orden = [...BLOQUES].sort((a, b) => a.desde - b.desde);
  const tramos = [];
  for (let i = 0; i < orden.length; i++) {
    const fin = orden[i].hasta;
    const sig = orden[(i + 1) % orden.length].desde + (i === orden.length - 1 ? PERIM : 0);
    if (sig > fin) tramos.push({ desde: fin, hasta: sig });
  }
  return tramos;
})();

/** Un hueco es escalera si es estrecho; si es ancho, es zona sin sección. */
export const esEscalera = (tramo) => tramo.hasta - tramo.desde < HUECO * 3;

/* ==========================================================================
 * TRIBUNA SUR
 *
 * Tribuna montada sobre el campo, en la cabecera Sur, a ras de suelo: sin
 * gradas ni desnivel. Se divide en cinco secciones (A–E) y sus butacas,
 * vistas desde arriba, componen un mosaico.
 * ========================================================================== */
export const TRIBUNA_SUR = {
  secciones: ['A', 'B', 'C', 'D', 'E'],
  columnas: 21,       // butacas por sección, a lo ancho
  filas: 24,          // filas hacia el fondo
  paso: 0.53,         // separación entre butacas contiguas
  fondo: 1.05,        // separación entre filas
  pasillo: 0.9,       // pasillo entre secciones
  // Montada en la cabecera oeste: las últimas filas se salen del césped y
  // apoyan sobre la pista, como en un montaje temporal de concierto.
  xFrente: -56,       // borde más cercano al centro del campo
  foso: 2.6,          // muro frontal antes de la primera fila, como en la grada
  // Sube 0.51 por 1.05 de fondo: la misma pendiente (26°) que la gradería
  // de hormigón, que sube 0.42 por 0.86.
  contra: 0.51,
};

/* ==========================================================================
 * CONFIGURACIÓN DE CONCIERTO
 * Escenario centrado en la cancha y campo repartido en tres accesos por
 * pasillos en aspa, como en el mapa de localidades.
 * ========================================================================== */
export const CONCIERTO = {
  escenario: { x: 0, rx: 13, rz: 16, alto: 2.6 },
  campo:     { xMin: -46, xMax: 46, ancho: 62, radio: 17 },
  pasillo:   3.6,
  brazo:     52,                        // largo de cada aspa
  zonas: [
    { id: 'CAMPO_A', nombre: 'Campo Acceso A', color: 0xe8232c },
    { id: 'CAMPO_B', nombre: 'Campo Acceso B', color: 0xf01c24 },
    { id: 'CAMPO_C', nombre: 'Campo Acceso C', color: 0xb0141b },
  ],
  densidadCampo: 2.2,                   // personas por m² a lleno total
};

/* ---------- Escenario 3D (modelo GLB) ---------- *
 * Escenario central estilo BTS: torres, paredes LED y cuatro pasarelas en
 * aspa. El modelo ya viene en metros (43 × 15 × 27 m), así que a escala 1
 * cuadra con el estadio. Se apoya en el centro del campo.
 */
export const ESCENARIO_MODELO = {
  escala: 2.2,        // 1 = tamaño nativo (~43 m); ampliado para el estadio
  giro: 0,            // rotación en Y, en radianes
  x: 8, z: 0,         // centro sobre el campo, desplazado hacia Acceso B (+x)
  base: 0.08,         // apoyo sobre la superficie del campo
  nativo: { ancho: 43.32, fondo: 27.03 },   // huella del modelo sin escalar
};

/** Semiejes de la huella del escenario ya escalada (para excluir público). */
export const HUELLA_ESCENARIO = {
  x: ESCENARIO_MODELO.x,
  z: ESCENARIO_MODELO.z,
  hx: ESCENARIO_MODELO.nativo.ancho * ESCENARIO_MODELO.escala * 0.5 * 0.62,
  hz: ESCENARIO_MODELO.nativo.fondo * ESCENARIO_MODELO.escala * 0.5 * 0.72,
};

/* ---------- Paleta ---------- */
export const COLOR = {
  hormigon:      0x9d9c94,
  hormigonSucio: 0x8b8a80,
  sinSeccion:    0x76756e,   // gradería sin localidades: apagada
  muro:          0x8e9b86,
  pista:         0xa2604e,
  cesped:        0x3f7a35,
  acero:         0x9aa0a6,
  campo:         0xd9202a,
  pasillo:       0x141416,
  escenario:     0x0e0e10,
};
