import { irAVista, setOrbita, VISTAS } from '../core/cameraRig.js';
import { regulador } from '../core/scene.js';
import { calidad } from '../core/perf.js';
import { FILAS, GRUPOS, BLOQUES, LIMITES, CONCIERTO, TRIBUNA_SUR } from '../config.js';

const ETIQUETAS = {
  aerea: 'Aérea', dron: 'Dron', tribuna: 'Tribuna',
  cancha: 'Cancha', arco: 'Arco', escenario: 'Escenario',
};

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const num = (n) => n.toLocaleString('es-PE');
const $ = (id) => document.getElementById(id);

export function crearInterfaz({
  publico, publicoCampo, publicoSur, selector, rotulos, aforoInicial, aforo,
  irALimite, tribunaSur, irATribunaSur, butacas,
}) {
  const { porBloque, porGrupo, campoPorZona } = aforo;
  // Vista única: el estadio con el escenario siempre montado.
  const modo = 'estadio';

  /* ------------------------------------------------ Panel en móvil */
  const ui = $('ui');
  const abrir = $('abrirPanel');
  const setPanel = (v) => {
    ui.dataset.abierto = String(v);
    abrir.setAttribute('aria-expanded', String(v));
  };
  abrir.onclick = () => setPanel(ui.dataset.abierto !== 'true');
  $('cerrarPanel').onclick = () => setPanel(false);

  /* -------------------------------------------------------- Vistas */
  const contVistas = $('vistas');
  const marcarVista = (nombre) => {
    contVistas.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', b.dataset.vista === nombre));
  };

  Object.keys(VISTAS).forEach((nombre, i) => {
    const b = document.createElement('button');
    b.textContent = ETIQUETAS[nombre] ?? nombre;
    b.dataset.vista = nombre;
    if (i === 0) b.classList.add('on');
    b.onclick = () => {
      marcarVista(nombre);
      selector.limpiar();
      irAVista(nombre);
      if (nombre === 'aerea') setOrbita(btnGirar.classList.contains('on'));
    };
    contVistas.appendChild(b);
  });

  /* ------------------------------------------------------- Límites *
   * Cada escalera de límite tiene nombre fijo (L1…L4) para poder
   * referirse a ella sin ambigüedad.
   */
  document.getElementById('limites').replaceChildren(...LIMITES.map((l) => {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="clave">${l.id}</span>` +
      `<span>${l.zona}</span>` +
      `<span class="cant">${l.metros} m</span>`;
    li.onclick = () => { irALimite(l.id); setPanel(false); };
    return li;
  }));

  /* ----------------------------------------------------- Secciones *
   * Cada grupo se despliega en sus bloques, con la letra y el aforo,
   * igual que en el mapa de localidades.
   */
  const lista = $('sectores');

  function filaGrupo(g) {
    const li = document.createElement('li');
    li.className = 'grupo';
    // en orden alfabético: puede no coincidir con el orden del arco
    const bloques = BLOQUES
      .filter((b) => b.grupo === g.id)
      .sort((a, b) => a.letra.localeCompare(b.letra));
    const rango = `${bloques[0].letra}–${bloques.at(-1).letra}`;

    li.innerHTML =
      `<span class="punto" style="background:${hex(g.color)}"></span>` +
      `<span>${g.nombre} <em>${rango}</em></span>` +
      `<span class="cant">${num(porGrupo.get(g.id) ?? 0)}</span>`;

    const caja = document.createElement('li');
    caja.className = 'bloques';
    for (const b of bloques) {
      const chip = document.createElement('button');
      chip.className = 'bloque';
      chip.textContent = b.letra;
      chip.title = `${g.nombre} ${b.letra} · ${num(porBloque.get(b.id) ?? 0)} localidades`;
      chip.onclick = (e) => {
        e.stopPropagation();
        selector.irABloque(b.id);
        setPanel(false);
      };
      caja.appendChild(chip);
    }

    li.onclick = () => li.classList.toggle('abierto');
    return [li, caja];
  }

  function filaCampo(zona) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="punto" style="background:${hex(zona.color)}"></span>` +
      `<span>${zona.nombre}</span>` +
      `<span class="cant">${num(campoPorZona.get(zona.id) ?? 0)}</span>`;
    li.onclick = () => { selector.aleatoriaCampo(); setPanel(false); };
    return li;
  }

  /** Tribuna Sur: cinco secciones a ras de campo, siempre presentes. */
  function filaTribunaSur() {
    const li = document.createElement('li');
    li.className = 'grupo abierto';
    li.innerHTML =
      `<span class="punto" style="background:#cd2e3a"></span>` +
      `<span>Tribuna Sur <em>A–E</em></span>` +
      `<span class="cant">${num(tribunaSur.aforo)}</span>`;
    li.onclick = () => li.classList.toggle('abierto');

    const caja = document.createElement('li');
    caja.className = 'bloques';
    TRIBUNA_SUR.secciones.forEach((letra, i) => {
      const chip = document.createElement('button');
      chip.className = 'bloque';
      chip.textContent = letra;
      chip.title = `Tribuna Sur ${letra} · ${num(tribunaSur.aforoSeccion)} butacas`;
      chip.onclick = (e) => {
        e.stopPropagation();
        irATribunaSur(i);
        setPanel(false);
      };
      caja.appendChild(chip);
    });
    return [li, caja];
  }

  function pintarSecciones() {
    const hijos = [];
    if (modo === 'concierto') hijos.push(...CONCIERTO.zonas.map(filaCampo));
    hijos.push(...filaTribunaSur());
    hijos.push(...GRUPOS.flatMap(filaGrupo));

    // la cabecera Sur entera es gradería vacía, sin localidades
    const nota = document.createElement('li');
    nota.className = 'inactivo';
    nota.innerHTML =
      `<span class="punto" style="background:${hex(0x76756e)}"></span>` +
      `<span>Cabecera Sur</span><span class="cant">vacía</span>`;
    hijos.push(nota);

    lista.replaceChildren(...hijos);
  }

  /* --------------------------------------------------------- Aforo */
  const slider = $('aforo');
  const valorAforo = $('aforoVal');
  slider.value = Math.round(aforoInicial * 100);
  let capacidad = 0;

  function refrescarAforo() {
    const f = slider.value / 100;
    valorAforo.textContent = slider.value + ' %';
    publico.setAforo(f);
    publicoSur.setAforo(f);
    publicoCampo.setAforo(modo === 'concierto' ? f : 0);

    const enGrada = [...porGrupo.values()].reduce((a, b) => a + b, 0);
    const enCampo = modo === 'concierto'
      ? [...campoPorZona.values()].reduce((a, b) => a + b, 0) : 0;
    capacidad = enGrada + enCampo + tribunaSur.aforo;

    pintarStats(Math.round(capacidad * f));
  }
  slider.oninput = refrescarAforo;

  /* --------------------------------------------------------- Stats */
  const stats = $('stats');
  let asistentes = 0;

  function pintarStats(n = asistentes) {
    asistentes = n;
    stats.innerHTML =
      `<b>${num(asistentes)}</b> de ${num(capacidad)} localidades<br>` +
      `${BLOQUES.length} secciones · ${Math.round(regulador.fps)} fps · ${calidad.perfil}`;
  }
  setInterval(() => pintarStats(), 1000);

  /* ------------------------------------------------------ Opciones */
  const btnGirar = $('btnGirar');
  btnGirar.onclick = () => {
    btnGirar.classList.toggle('on');
    setOrbita(btnGirar.classList.contains('on'));
  };

  const btnPublico = $('btnPublico');
  btnPublico.onclick = () => {
    btnPublico.classList.toggle('on');
    const v = btnPublico.classList.contains('on');
    publico.setVisible(v);
    publicoSur.setVisible(v);
    publicoCampo.setVisible(v);
  };

  const btnButacas = $('btnButacas');
  btnButacas.onclick = () => {
    btnButacas.classList.toggle('on');
    const v = btnButacas.classList.contains('on');
    butacas.setVisible(v);
    tribunaSur.setButacasVisible(v);
  };

  const btnRotulos = $('btnRotulos');
  btnRotulos.onclick = () => {
    btnRotulos.classList.toggle('on');
    const v = btnRotulos.classList.contains('on');
    rotulos.setVisible(v);
    rotulos.setCampoVisible(v && modo === 'concierto');
  };

  /* --------------------------------------------- Ficha de localidad */
  const ficha = $('localidad');
  const locEtiqueta = $('locEtiqueta');
  const locTitulo = $('locTitulo');
  const locDatos = $('locDatos');

  $('cerrarLocalidad').onclick = () => {
    selector.limpiar();
    irAVista(modo === 'concierto' ? 'escenario' : 'aerea');
  };

  const dato = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;

  pintarSecciones();
  refrescarAforo();

  return {
    mostrarUbicacion(sel) {
      contVistas.querySelectorAll('button').forEach((b) => b.classList.remove('on'));

      if (sel.tipo === 'tribuna-sur') {
        locEtiqueta.textContent = 'Tribuna Sur';
        locTitulo.textContent = `Sección ${sel.letra}`;
        locDatos.innerHTML =
          dato('Fila', `${sel.fila + 1} de ${TRIBUNA_SUR.filas}`) +
          dato('Butaca', `${sel.columna + 1} de ${TRIBUNA_SUR.columnas}`) +
          dato('Aforo sección', num(sel.aforoSeccion)) +
          dato('Al escenario', `${Math.hypot(sel.x - CONCIERTO.escenario.x, sel.z).toFixed(0)} m`);
        ficha.classList.remove('oculto');
        return;
      }

      if (sel.tipo === 'campo') {
        locEtiqueta.textContent = 'Campo · de pie';
        locTitulo.textContent = sel.zona.nombre;
        locDatos.innerHTML =
          dato('Al escenario', `${sel.distancia.toFixed(0)} m`) +
          dato('Aforo de zona', num(sel.aforoZona)) +
          dato('Numerada', 'No');
      } else {
        const { bloque } = sel;
        locEtiqueta.textContent = `Tribuna ${bloque.nombreGrupo}`;
        locTitulo.textContent = `Sección ${bloque.letra}`;
        const ref = modo === 'concierto'
          ? ['Al escenario', Math.hypot(sel.x - CONCIERTO.escenario.x, sel.z)]
          : ['Al centro', Math.hypot(sel.x, sel.z)];
        locDatos.innerHTML =
          dato('Fila', `${sel.fila + 1} de ${FILAS}`) +
          dato('Asiento', `${sel.plaza + 1} de ${sel.totalFila}`) +
          dato('Aforo sección', num(porBloque.get(bloque.id) ?? 0)) +
          dato('Altura', `${sel.y.toFixed(1)} m`) +
          dato(ref[0], `${ref[1].toFixed(0)} m`);
      }
      ficha.classList.remove('oculto');
    },
    ocultarUbicacion() { ficha.classList.add('oculto'); },
  };
}
