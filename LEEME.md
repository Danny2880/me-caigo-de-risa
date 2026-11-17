# Me caigo de risa — El desafío

Plataforma para conducir los 7 juegos del cumpleaños pirata desde una tablet.
No necesita internet ni instalación: es HTML, CSS y JavaScript puro.

## Abrirla en la tablet

1. Conecta la computadora y la tablet a la **misma red Wi-Fi**.
2. En la computadora, abre Terminal y ejecuta:

   ```bash
   cd "ruta/a/me-caigo-de-risa"
   ./iniciar.command
   ```

   (También puedes hacer doble clic en `iniciar.command` desde Finder.)
3. La terminal mostrará dos direcciones:

   - `http://localhost:8899` → para verla en la computadora.
   - `http://192.168.x.x:8899` → **esta es la que abres en la tablet**.

4. En la tablet, abre Safari/Chrome y escribe la dirección de la red.
5. Para que se vea como app: en Safari toca **Compartir → Añadir a pantalla de inicio**.

> Si el puerto 8899 está ocupado, edita `iniciar.command` y cambia `PORT`.

## Dónde se guarda todo

Los jugadores, el historial y el contenido se guardan en el **almacenamiento del
navegador** de ese dispositivo (no en un servidor). Eso significa:

- Si abres la app en otra tablet u otro navegador, empieza vacía.
- Si borras los datos del navegador, se pierde el historial.
- Antes de la fiesta: **Ajustes → Descargar respaldo** y guarda el `.json`.
  Para recuperarlo: **Ajustes → Restaurar respaldo**.

## Los 7 juegos

| # | Juego | Qué hace la app |
|---|---|---|
| 1 | Teléfono descompuesto | Dos equipos en fila. N−1 mímicas de 10 s (quien actúa → quien observa); quien adivina responde **sin reloj**. Película al azar u elegida de la lista |
| 2 | Caricaturas eléctricas | Arrancan 3, hasta 3 reemplazos sugeridos por rotación; sin reemplazos pasa a la final 1 vs 1 |
| 3 | Almohadazo | Duelo 1 vs 1 en el pizarrón, consignas opuestas, **mismo tiempo para ambos**, muerte súbita si empatan |
| 4 | Cascarón Piratas | Dos filas, «¡Piratas!», quien pierde vuelve al final de su fila; se puede retirar o sumar gente a media partida |
| 5 | Te la compro | Subasta de cantidades; la app preselecciona al retado (quien apostó antes) y rota quién abre cada ronda |
| 6 | Sándwich de letras | Carrera entre dos equipos por el mismo par de letras; deshacer punto y par de desempate |
| 7 | Sin palabras | Parejas de una en una, mazo sin repeticiones entre parejas, revancha con roles invertidos |

Las reglas completas (objetivo, cómo se juega, cómo se gana y casos especiales)
están en la pantalla de reglas de cada juego. Las decisiones de diseño y la lógica
interna están documentadas en **`MECANICAS.md`**.

## Cosas útiles durante la fiesta

- **Pasar lista** (Jugadores): marca a cada persona como *Presente* o *Ausente*.
  Solo las presentes aparecen en los juegos. Quien llega tarde se reactiva con un
  toque o escribiendo su nombre (no se duplica).
- **Rotación justa**: las sugerencias ponen primero a quien menos ha jugado en
  total, luego a quien menos ha jugado ese juego y luego a quien jugó hace más tiempo.
- **Partida en curso**: se guarda en cada pantalla. Si la tablet recarga o sales
  con «×», al volver al juego aparece «Continuar partida». Los relojes vuelven en pausa.
- **Relojes**: todos tienen *Pausar*, *Reanudar* y *Reiniciar reloj* (repetir turno).
- **Corregir errores**: «← Atrás» regresa una pantalla dentro del juego; tras
  registrar, el aviso ofrece *Deshacer* durante 6 s; después puedes borrar el
  registro en Jugadores → Partidas registradas.
- **Cierre de partida**: *Registrar y salir*, *Registrar y jugar otra/revancha* o
  *Descartar* (pide confirmación). Ningún botón descarta resultados sin avisar.
- **Modo público (👁)**: dentro de cada juego oculta los controles y agranda la
  consigna para verla de lejos.
- **Equipos**: se reparten parejos (diferencia máxima de 1) y la app evita repetir
  compañeros de juegos anteriores.
- **Gestor de contenido** (Ajustes → Contenido) y **mazos usados** (Ajustes →
  reiniciar) funcionan igual que antes.
- **Juegos propios**: en Juegos → «+ Añadir juego».

## Estructura de archivos

```
me-caigo-de-risa/
├── index.html
├── iniciar.command          ← servidor local para la tablet
├── LEEME.md
├── MECANICAS.md         ← reglas, decisiones y casos especiales
├── css/styles.css
└── js/
    ├── data.js              ← contenido inicial (editable desde la app)
    ├── store.js             ← estado, historial, equipos, respaldos
    ├── ui.js                ← componentes y cronómetro
    ├── app.js               ← inicio, catálogo, jugadores, ajustes, contenido
    └── games/
        ├── j1-telefono.js
        ├── j2-caricaturas.js
        ├── j3-almohadazo.js
        ├── j4-cascaron.js
        ├── j5-telacompro.js
        ├── j6-sandwich.js
        └── j7-sinpalabras.js
```

## Notas

- No requiere compilación ni dependencias: los archivos se abren tal cual.
- No modifica los PDF, fotos ni manuales de la marca: todo el contenido de la app
  es independiente y editable.
- Si algo se ve raro en la tablet, gira la pantalla a horizontal: está pensada
  para verse en horizontal.

## Publicación (GitHub + Netlify)

- Repositorio: `github.com/Danny2880/me-caigo-de-risa` (rama `main`).
- Netlify publica la carpeta raíz tal cual (ver `netlify.toml`); no hay comando de build.
- Cada `git push` a `main` vuelve a publicar el sitio automáticamente.
- `.build/` (respaldos y pruebas) queda fuera del repositorio por `.gitignore`.
- Los jugadores y el historial viven en el navegador de cada dispositivo
  (localStorage): el sitio en Netlify empieza con la lista base de `js/data.js`.
