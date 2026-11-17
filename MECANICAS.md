# Mecánicas y decisiones — Me caigo de risa

Documento para quien mantenga la app (personas o agentes). Explica **cómo funciona
cada regla y por qué**. Si cambias una mecánica en el código, actualiza aquí y en
el texto de reglas del juego (`viewRules` / `viewReglas` de cada archivo en
`js/games/`): la regla escrita debe coincidir siempre con lo que hace la pantalla.

---

## 1. Participantes (`js/store.js`)

Cada jugador está en uno de tres estados:

| Estado | Cómo se ve | Para qué |
|---|---|---|
| Presente | Aparece en todos los juegos y sugerencias | Lo normal |
| Ausente (`absent: true`) | Sigue en **Jugadores**, atenuado; los juegos no lo ofrecen | Llegó tarde, salió un rato, ya se fue |
| Archivado (`archived: true`) | Desaparece de la lista | «Eliminar» a alguien que **ya tenía partidas** |

- `MCR.store.players()` → solo presentes. **Es lo que deben usar los juegos.**
- `MCR.store.roster()` → presentes + ausentes (pantalla Jugadores, mapa de Inicio).
- `MCR.store.byId()` encuentra también archivados, para que el historial siga
  mostrando nombres en lugar de «—».
- **Eliminar** sin historial borra de verdad; con historial solo archiva.
- **Añadir es idempotente por nombre** (ignora mayúsculas, acentos y espacios
  dobles): si «Ana» ya existe, se reactiva como presente en vez de crear un
  duplicado que partiría sus estadísticas. Aplica en Jugadores y en el «+ Añadir»
  de cada juego.
- **Corregir nombre** no permite usar el nombre de otra persona activa.

### Llegadas tarde y salidas
- Llega alguien: escribe su nombre en cualquier «Añadir» (Jugadores o dentro del
  juego). En juegos de equipos va al equipo/fila más corto.
- Se va alguien: márcalo **Ausente** en Jugadores. Dentro de un juego en curso:
  Teléfono → «omitir» antes de su turno; Cascarón → ✕ en su fila;
  Te la compro → «se retira» en la mesa; Caricaturas → márcalo como eliminado.

## 2. Rotación justa (`MCR.store.recommend`)

Las sugerencias («✨ Sugerir», reemplazos, «Completar N») ordenan a los presentes:

1. **Menos partidas en total** — nadie se queda fuera toda la fiesta.
2. **Menos veces en este juego** — a igualdad, el juego se reparte entre más gente.
3. **Jugó hace más tiempo** — quien acaba de jugar descansa.
4. **Empate → al azar** (nunca alfabético, para no favorecer a «Abril»).

Los juegos de equipo suman 1 partida a todos los que juegan, así que no alteran el
orden relativo. Quien llegó tarde o estuvo ausente queda con menos partidas y sube
de prioridad automáticamente. Todo se calcula desde `state.events`; no hay
contadores que se puedan desincronizar.

## 3. Equipos (`MCR.store.makeTeams`)

- Reparto circular (`i % k`): la diferencia entre equipos **nunca pasa de 1**.
  Con números impares, qué equipo queda con la persona extra se decide al azar.
- Prueba hasta 400 mezclas y se queda con la que **menos repite compañeros** de
  juegos anteriores (`state.teams`, últimas 40 formaciones).
- Ajustes manuales (flecha, «Reequilibrar», añadir) no rompen esa garantía si se
  usa «Reequilibrar»; el aviso de balance aparece desde 2 de diferencia.

## 4. Temporizador (`MCR.ui.newTimer` / `MCR.ui.timerView`)

Un solo componente para todos los relojes: `{ total, remaining, status }` con
`status` = `idle | running | paused | done`.

- **Pausar / Reanudar** sin perder tiempo.
- **Reiniciar reloj** vuelve al tiempo completo (sirve para «repetir el turno»).
- El estado vive dentro del estado del juego, así que sobrevive a cada repintado
  y a la restauración de una partida: un reloj que corría **vuelve en pausa**.

| Juego | Quién tiene reloj | Duración |
|---|---|---|
| Teléfono | Cada mímica (quien actúa → quien observa). **Quien adivina no.** | 10 s fijos |
| Almohadazo | Cada duelista en su turno | A elegir en el turno 1; el turno 2 hereda el mismo |
| Sándwich | La ronda completa (carrera entre equipos) | A elegir |
| Sin palabras | Cada pareja | A elegir; igual para todas |

## 5. Reglas y condiciones de victoria

**Teléfono descompuesto** — Fila de N personas por equipo → N−1 mímicas de 10 s.
En la mímica k actúa `order[k]` y observa `order[k+1]`. La última persona solo
adivina, sin reloj. Gana el equipo que acierta; ambos = empate; ninguno = nadie.
Revancha: adivina quien antes empezaba la fila (rota el papel más visible).

**Caricaturas eléctricas** — Arrancan 3; cada eliminación usa un reemplazo
(máx. 3) mientras haya gente disponible. Sin reemplazos → final 1 vs 1 con una
categoría. Gana quien no falla en la final.

**Almohadazo** — 1 vs 1, un turno por persona con consignas distintas (modo
contrario y otra sílaba en el turno 2), mismo tiempo. Gana quien escribe más
palabras válidas; empate → muerte súbita hablada. Cada duelo se registra aparte.

**Cascarón Piratas** — Dos filas; ganador del duelo sale a salvo, perdedor vuelve
al final de **su** fila. Fila vacía → se redistribuye. Termina con 1 persona (gran
perdedor). Cuentan como victoria solo los invictos.

**Te la compro** — Subasta: cada quien sube la cantidad de palabras que promete.
Quien no quiere subir dice «Te la compro» a quien apostó antes (la app lo
preselecciona). Cumple → sale quien compró; no cumple → sale quien apostó. Cada
ronda la abre la siguiente persona. Gana quien queda al final.

**Sándwich de letras** — Carrera: los dos equipos ven el mismo par; el primero
que acierta suma. Empate al terminar el reloj → par de desempate sin reloj.

**Sin palabras** — Parejas de una en una (🎧 adivina / 🗣️ dice). Mazo único por
partida: ninguna pareja recibe una palabra que otra ya dijo en voz alta. Al
terminar el reloj se confirma si la última palabra entró. Gana la pareja con más
aciertos; empate en primer lugar = victoria compartida.

## 6. Situaciones excepcionales

| Situación | Qué hace la app |
|---|---|
| Se cierra la pestaña / recarga la tablet / se sale con «×» | La partida se guarda en cada pantalla (`MCR.store.live`, llave `mcr:live:v1`). Al volver a abrir el juego aparece «Hay una partida sin terminar → Continuar / Descartar». |
| Se registró un resultado equivocado | Aviso con **Deshacer** durante 6 s. Después: Jugadores → Partidas registradas → Borrar. Las estadísticas se recalculan solas. |
| Se tocó mal un punto | Sándwich: «Deshacer último punto». Sin palabras: «Deshacer». Otros: «← Atrás» regresa a la pantalla anterior con el estado anterior. |
| Interrupción a mitad de turno | «Pausar»; o «Reiniciar reloj» para repetir el turno completo. |
| Alguien termina antes | Teléfono «Terminó antes», Almohadazo «Terminar turno». |
| Se acabó el contenido (películas, categorías) | Mostrar usadas / permitir repetir / reiniciar mazo en Ajustes. |
| Ya no hay reemplazos en Caricaturas | Pasa directo a la final. |

**«← Atrás» y el historial:** dentro de un juego retrocede pantallas con su estado
(no registra nada). Después de registrar una partida no se puede retroceder a la
pantalla previa al registro (para eso existe «Deshacer»).

**Cierre de partida (`MCR.ui.finishBar`):** todos los juegos terminan con las
mismas opciones: *Registrar y salir*, *Registrar y jugar otra / revancha* y
*Descartar* (pide confirmación). Ya no existe ningún botón que descarte un
resultado sin avisar.

## 7. Arquitectura en breve

- `js/store.js` — estado persistente (`mcr:state:v1`), jugadores, historial,
  rotación, equipos, contenido usado, respaldo y partida en curso.
- `js/ui.js` — componentes compartidos: shell de juego, reloj, reglas, selector
  de jugadores, tablero de equipos, cierre de partida, navegación interna.
- `js/games/jN-*.js` — cada juego es un módulo con un estado `S` y una vista por
  paso (`S.step`). `render()` repinta todo en cada cambio; `MCR.ui.gameNavigation`
  (al final de cada render) maneja Atrás, guardado en curso y «Continuar».
- `css/styles.css` — la **capa v5 al final** define tokens de ambos temas y los
  componentes. Las capas anteriores siguen ahí por compatibilidad; si un estilo
  nuevo no se aplica, revisa primero la especificidad frente a las reglas viejas.

## 8. Selección de participantes (`MCR.ui.peoplePicker`)

No todos los juegos eligen igual, así que el selector tiene tres modos con las
mismas piezas (buscador que añade, filas compactas de una línea, ausentes al pie):

| Modo | Dónde | Cómo se lee |
|---|---|---|
| `roster` | Teléfono, Cascarón, Sándwich, Sin palabras («¿Quiénes juegan?») | Vienen todos dentro. La bandeja muestra solo a quienes **descansan**; esas filas se ven punteadas y tachadas. Lista A–Z. |
| `pick` | Caricaturas (3), Almohadazo (2), Te la compro (3–6) | Bandeja con lugares numerados (en Te la compro = orden de la mesa). Lista ordenada por rotación justa; «Le toca» marca a los mejores candidatos para los lugares libres. |
| `single` | Reemplazo en Caricaturas | Un toque = entra. La sugerencia aparece primero, resaltada. |

- **Una sola acción masiva que cambia con el estado** (en vez de varios botones):
  `pick` → «✨ Sugerir N» / «✨ Completar K» (conserva lo elegido) / «✨ Otra sugerencia»;
  `roster` → «✓ Incluir a todos» / «Quitar a todos». «Vaciar» vive en la bandeja.
- **Lleno**: en `pick`, tocar a alguien más no lo agrega; avisa «Quita a alguien de arriba».
- **Buscador**: filtra sin acentos ni mayúsculas; Enter elige si queda una sola
  coincidencia; si no hay, ofrece «+ Añadir “nombre”» (idempotente, ver §1).
- **Ausentes**: aparecen al pie; un toque los marca presentes y los suma.
- **Rotación**: «Le toca» y el orden usan los criterios de `recommend` (§2) pero sin
  azar (desempate alfabético) para que la lista no salte. Informa, nunca bloquea.

### Equipos (`MCR.ui.teamBalance`)
Panel único: conteo + barra arriba y una fila de herramientas debajo:
🎲 Mezclar · ⚖ Reequilibrar (solo con 2+ de diferencia) · acciones contextuales ·
«Sumar a alguien» (va al equipo más corto). **Mezclar reparte a quienes están hoy en
los equipos**, incluida la gente sumada en esa pantalla; en Teléfono quien descansaba
sigue descansando. En Teléfono no hay «Todos / Ninguno»: si alguien descansa aparece
«✓ Incluir a los N que descansan», que conserva a quien adivina.

## 9. Jerarquía de botones

| Nivel | Clase | Uso | Posición |
|---|---|---|---|
| Principal | `.btn-gold` (`.btn-xl` en el pie) | Una por pantalla: Empezar, Continuar, Registrar, la acción que se repite en la partida | Pie, a la derecha |
| Secundaria | `.btn-ghost` | Alternativa real al avance (Atrás, «Subió la apuesta», Mezclar) | Pie a la izquierda o junto a lo que afecta |
| Herramienta | `.btn-quiet .mini` | Ayudas sobre una lista o dato (Sugerir, Vaciar, Cambiar categoría, Mostrar usadas) | Cabecera del panel que controla |
| Destructiva | `.btn-quiet.danger-text` o `.btn-danger` + confirmación | Descartar, Borrar | Separada de la principal |

- Una **opción elegida** (duración, Empiezan/Terminan) es un estado, no una acción:
  usa tono suave (`.opt-on`, `.segmented .seg-on`), nunca el violeta sólido.
- «← Atrás» escrito dentro de una vista se traslada solo al pie (`gameNavigation`).

## 10. Cambio de jugador y película en grande (v7)

- **🔄 Cambio** (arriba a la derecha durante la partida) en Teléfono, Almohadazo, Cascarón, Te la compro, Sándwich y Sin palabras: se elige quién sale y quién entra (buscador; se puede escribir un nombre nuevo). Quien entra toma el lugar exacto (equipo, turno, pareja, fila). Lo ya jugado (historial, resultados, eliminados, puntos) no cambia de dueño. Implementado en `MCR.ui.swapPlayer`.
- **Caricaturas**: el botón del pie se llama «🔄 Cambio →» y usa su propio flujo de eliminado + reemplazo (máximo 3).
- **Teléfono**: «Mostrar película» abre una pantalla completa con el título enorme (`MCR.ui.reveal`); se cierra tocando en cualquier lugar, con la × o con Esc. Al tocar «🔄 Cambio · arranca 10 s» o «Terminó antes · cambio» la siguiente mímica empieza sola.

## 11. Marcar y confirmar (v8)

Elegir a una persona nunca avanza con un solo toque: el toque marca (✓) y el botón principal del pie confirma («Confirmar · sale X →», «✓ Confirmar · entra X», «🏆 Confirmar · ganó X»). Tocar de nuevo desmarca. Aplica a: Caricaturas (quién sale, quién entra, ganador de la final), Almohadazo (muerte súbita), Te la compro (quién compró y a quién) y la ventana 🔄 Cambio de todos los juegos (quién sale → Siguiente; quién entra → Confirmar). Helpers: `MCR.ui.choiceGrid` y `MCR.ui.confirmBtn`. Los botones con resultado explícito («Gana X» en Cascarón, «Sí lo logró / No lo logró» en Te la compro) siguen siendo directos porque ya son la confirmación.
