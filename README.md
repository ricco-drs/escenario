# Estadio San Marcos — simulación 3D

Reconstrucción interactiva del Estadio de la Universidad Nacional Mayor de San
Marcos (Lima) con Three.js y Vite: pista de atletismo reglamentaria, graderías
de hormigón, montaje de concierto y selección de localidad.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

## Estructura

```
index.html              cascarón + interfaz
vite.config.js          build, chunking y nombres con hash
public/_headers         cabeceras de caché para el CDN
src/
  config.js             todas las medidas del estadio (única fuente de verdad)
  main.js               orquestación: construye el mundo y lo conecta a la UI
  styles.css            interfaz (tokens, paneles, responsive)
  core/
    scene.js            escena, render, luces, bucle
    perf.js             perfil de calidad y regulador adaptativo
    cameraRig.js        órbita, vuelos de cámara, vistas
  geometry/
    oval.js             curva base del estadio y su inversa
    loft.js             extrusión de un perfil a lo largo del óvalo
  world/
    ground.js           pista y cancha (textura cenital procedural)
    stands.js           graderías por sector, escaleras, barandas, muro
    details.js          porterías, banderines, banquillos, caseta
    seating.js          discretización de la grada en plazas
    crowd.js            público instanciado, animado en GPU
    concert.js          escenario, campo, pasillos y zonas de concierto
    stage.js            carga del escenario BTS (modelo GLB) sobre el campo
    southStand.js       tribuna Sur a ras de campo, en cinco secciones
    mosaic.js           bandera dibujada en metros y muestreada por butaca
    labels.js           rótulos de secciones, límites y accesos
  interaction/
    seatPicker.js       clic en la grada → ubicación → vista desde el asiento
  ui/
    panel.js            panel de control y ficha de localidad
```

## Ideas clave

**Todo nace de una curva.** `geometry/oval.js` define el borde interior de la
pista (dos rectas de 84.39 m y dos semicírculos de radio 36.5 m). Cualquier
elemento del estadio es esa curva desplazada `d` metros y extruida con `loft()`.
Cambiar una medida en `config.js` regenera todo de forma coherente.

**`ovalInverse()` hace posible la interacción.** Dado un punto del mundo
devuelve su arco y su distancia a la curva; de ahí salen la fila, el asiento y
el sector sobre los que se hizo clic, sin crear decenas de miles de objetos
clicables.

**El público no cuesta CPU.** Las matrices de las instancias se calculan una
sola vez; el salto y el balanceo ocurren en el vertex shader a partir de un
atributo de fase. Ajustar el aforo sólo mueve `InstancedMesh.count`.

## Secciones

La gradería no es un anillo continuo: son **35 bloques** separados por
escaleras, replicando el mapa de localidades del estadio.

| Tribuna   | Ubicación     | Bloques | Ancho por bloque | La A queda… |
|-----------|---------------|---------|------------------|-------------|
| Occidente | recta         | A–M (13)| 5.0 m            | junto a Sur |
| Norte     | curva         | A–J (10)| 10.0 m           | junto a Occidente |
| Oriente   | recta         | A–L (12)| 5.5 m            | junto a Sur |

Las dos rectas se numeran **desde el mismo extremo**: la A de Occidente y la de
Oriente quedan enfrentadas junto a la cabecera Sur, y M y L junto a la curva
Norte. Como el arco recorre el óvalo en un solo sentido, Oriente lleva
`invertir: true` en `GRUPOS` para numerarse al revés que el arco.

La **cabecera Sur está vacía**: sus 116.2 m de gradería se construyen en
hormigón apagado, sin público, sin rótulos, fuera del aforo y sin poder
clicarse.

Hay 36 escaleras: 34 **de paso**, de 1.5 m, en cada hueco entre bloques, y 2
**de límite**, de 2.6 m, donde la zona con localidades se corta contra la
cabecera vacía. Estas últimas llevan un pretil escalonado de 1.15 m que cierra
el sector — son la frontera del recinto vendible.

En modo concierto, el campo se reparte en tres accesos separados por pasillos
en aspa: **Acceso A** (sector superior), **Acceso B** (derecha) y
**Acceso C** (izquierda).

### Tribuna Sur

Montada sobre el campo en la cabecera oeste, escalonada como el resto del
estadio: cada fila sube 51 cm sobre la anterior, lo que da los mismos **26° de
pendiente** que la gradería de hormigón (que sube 42 cm cada 86).

| | |
|---|---|
| Secciones | A–E (5) |
| Butacas por sección | 21 × 24 = 504 |
| Total | **2 520 butacas** |
| Dimensiones | 59.3 m de ancho × 25.2 m de fondo |
| Altura | 0.45 m la primera fila, 12.2 m la última |

Sólo las 7 primeras filas quedan sobre césped: el resto apoya sobre la pista,
como en un montaje temporal. La esquina trasera queda a 1.5 m del muro de la
gradería.

Las butacas no se colorean a mano: `mosaic.js` dibuja la bandera **en metros**
sobre un lienzo y cada butaca muestrea el color que le toca según su posición.
Por eso el taeguk sale redondo aunque la retícula de butacas no sea cuadrada, y
por eso cambiar el número de filas o el paso entre butacas reajusta el dibujo
solo, sin retocar nada.

`config.js` → `GRUPOS` es la única fuente de verdad: cambiar el número de
bloques de una tribuna regenera geometría, escaleras, rótulos, aforo y
selección de asiento a la vez.

## Rendimiento

Dos capas, en `core/perf.js`:

1. **Perfil inicial** deducido de núcleos, memoria y tipo de puntero. Decide
   resolución de la textura del terreno, sombras, antialias y tamaño máximo de
   la muestra de público (9 000 / 20 000 / 45 000).
2. **Regulador adaptativo**: mide el tiempo de fotograma y ajusta el pixel ratio
   en caliente, con histéresis para no oscilar.

Además: mapa de sombras estático (se recalcula sólo al cambiar de
configuración), materiales Lambert en el público, geometría instanciada,
`resize` con rebote y pausa total al ocultar la pestaña.

## Escalar a muchos usuarios

El sitio es **estático**: no hay backend ni estado por usuario, así que la
concurrencia es un problema de entrega, no de código. Compilado pesa unos
**145 KB gzip** repartidos en tres archivos.

Sube `dist/` a cualquier CDN estático (Cloudflare Pages, Netlify, Vercel,
S3 + CloudFront). `public/_headers` ya marca los assets como `immutable`, así
que a partir de la primera visita el borde del CDN sirve prácticamente todo sin
tocar el origen. Decenas de miles de visitas simultáneas se atienden desde caché
de borde.

Lo que **no** aguanta esa carga es `npm run dev` ni `python -m http.server`:
son servidores de desarrollo de un solo proceso, para usar sólo en local.
