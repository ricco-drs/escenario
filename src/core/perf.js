/**
 * Presupuesto de rendimiento.
 *
 * Dos capas:
 *  1. Un perfil inicial deducido del dispositivo (núcleos, memoria, tipo de
 *     puntero) que decide resolución de texturas, sombras y aforo máximo.
 *  2. Un regulador que mide el tiempo de fotograma y ajusta el pixel ratio
 *     en caliente. Es lo que evita que un portátil integrado se arrastre.
 */

const esTactil = matchMedia('(pointer: coarse)').matches;
const nucleos = navigator.hardwareConcurrency ?? 4;
const memoria = navigator.deviceMemory ?? 4;

function deducirPerfil() {
  if (esTactil && (nucleos <= 4 || memoria <= 4)) return 'bajo';
  if (nucleos <= 4 || memoria <= 4) return 'medio';
  if (nucleos >= 8 && memoria >= 8) return 'alto';
  return 'medio';
}

const PERFILES = {
  bajo:  { dprMax: 1.25, sombras: false, texturaPX: 6,  publicoMax: 9000,  antialias: false },
  medio: { dprMax: 1.6,  sombras: true,  texturaPX: 8,  publicoMax: 20000, antialias: true },
  alto:  { dprMax: 2.0,  sombras: true,  texturaPX: 10, publicoMax: 45000, antialias: true },
};

export const perfil = deducirPerfil();
export const calidad = { ...PERFILES[perfil], perfil };

/**
 * Regulador adaptativo del pixel ratio.
 * Baja la resolución si el fotograma se pasa del presupuesto y la recupera
 * cuando sobra margen, con histéresis para no oscilar.
 */
export function crearRegulador(renderer, { objetivoMs = 16.7 } = {}) {
  let dpr = Math.min(devicePixelRatio, calidad.dprMax);
  renderer.setPixelRatio(dpr);

  let acumulado = 0, muestras = 0, enfriamiento = 0;
  let fps = 0;

  function medir(dt) {
    const ms = dt * 1000;
    acumulado += ms;
    muestras++;
    if (muestras < 45) return;

    const medio = acumulado / muestras;
    fps = 1000 / medio;
    acumulado = 0; muestras = 0;

    if (enfriamiento > 0) { enfriamiento--; return; }

    if (medio > objetivoMs * 1.35 && dpr > 0.7) {
      dpr = Math.max(0.7, dpr - 0.15);
      renderer.setPixelRatio(dpr);
      enfriamiento = 2;
    } else if (medio < objetivoMs * 0.72 && dpr < Math.min(devicePixelRatio, calidad.dprMax)) {
      dpr = Math.min(devicePixelRatio, calidad.dprMax, dpr + 0.1);
      renderer.setPixelRatio(dpr);
      enfriamiento = 4;
    }
  }

  return {
    medir,
    get fps() { return fps; },
    get dpr() { return dpr; },
  };
}
