import { setEmpuje } from '../core/cameraRig.js';

/**
 * Pad de flechas: mantén pulsada una flecha para orbitar la cámara, igual
 * que arrastrar con el ratón en PC. Pensado sobre todo para móvil, donde el
 * arrastre táctil compite con la selección de asiento.
 *
 * Se puede mantener más de una flecha a la vez (p. ej. arriba + derecha).
 */
const DIRECCIONES = {
  left:  { az: -1, pol: 0 },
  right: { az: +1, pol: 0 },
  up:    { az: 0, pol: +1 },
  down:  { az: 0, pol: -1 },
};

export function crearDpad() {
  const pad = document.getElementById('dpad');
  if (!pad) return;

  const activas = new Set();

  const recalcular = () => {
    let az = 0, pol = 0;
    for (const dir of activas) { az += DIRECCIONES[dir].az; pol += DIRECCIONES[dir].pol; }
    setEmpuje(Math.sign(az), Math.sign(pol));
  };

  for (const boton of pad.querySelectorAll('button')) {
    const dir = boton.dataset.dir;

    const iniciar = (e) => {
      e.preventDefault();               // no dispares el "clic" de selección
      activas.add(dir);
      recalcular();
    };
    const soltar = () => {
      if (activas.delete(dir)) recalcular();
    };

    boton.addEventListener('pointerdown', iniciar);
    boton.addEventListener('pointerup', soltar);
    boton.addEventListener('pointerleave', soltar);
    boton.addEventListener('pointercancel', soltar);
  }
}
