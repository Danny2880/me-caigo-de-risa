window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 01 — Teléfono descompuesto (Películas)
   Dos equipos · cadena de mímica de 10 s · el último adivina sin reloj

   Flujo: portada → reglas → participantes → equipos → [por equipo:
   película → mímicas (N−1) → respuesta → revelar] → resultado.
   Roles en cada fila (S.order[team], con quien adivina al final):
     · order[0]          ve la película y hace la primera mímica.
     · order[1..N-2]     observan una mímica y la repiten a la siguiente persona.
     · order[N-1]        observa la última mímica y adivina. NO tiene reloj.
   ========================================================= */

(function () {
  const { h } = MCR.ui;
  const TURN_SECONDS = 10;

  let S = null;
  let rootEl = null;

  function reset() {
    S = {
      step: 'portada',
      teams: null,
      picks: null,
      chain: [[], []],
      guesser: [null, null],
      order: [[], []],
      turn: 0,
      movie: null,
      results: [null, null],
      titles: [],
      idx: 0,          // índice de la mímica en curso (actúa order[idx], observa order[idx+1])
      timer: null,     // reloj compartido de MCR.ui.newTimer
      ctrl: null,
      collapsed: [false, false]
    };
  }

  function allIds() { return MCR.store.players().map((p) => p.id); }
  function teamName(i) { return 'Equipo ' + (i === 0 ? '1' : '2'); }
  function teamColor(i) { return i === 0 ? 'Azul' : 'Rojo'; }

  function activeIds() {
    return Array.from(new Set([].concat(S.chain[0], S.chain[1])));
  }

  function roleOf(pos, len) {
    if (pos === 0) return { k: 'start', label: 'Empieza' };
    if (pos === len - 1) return { k: 'guess', label: 'Adivina' };
    return { k: 'mid', label: 'Cadena' };
  }

  function render(root) {
    if (!S || root.dataset.newEntry === 'true') {
      if (S && S.ctrl) S.ctrl.stop();
      reset();
    }
    root.dataset.view = S.step;
    rootEl = root;
    if (S.ctrl) { S.ctrl.stop(); S.ctrl = null; }

    const { root: g, body, foot } = MCR.ui.shell({
      title: 'Teléfono descompuesto',
      sub: 'Películas · Juego 01',
      backTo: 'home',
      swap: { S, route: 'game:telefono', gameId: 'telefono', steps: ['pick', 'relay', 'answer'], ids: () => (S.order || []).flatMap((o, t) => t < S.turn ? [] : t === S.turn && S.step !== 'pick' ? o.slice(S.idx) : o) }
    });
    root.append(g);

    const views = {
      portada: viewPortada,
      reglas: viewReglas,
      participantes: viewParticipantes,
      equipos: viewEquipos,
      pick: viewPick,
      relay: viewRelay,
      answer: viewAnswer,
      revelar: viewRevelar,
      resultado: viewResultado
    };
    const viewEl = (views[S.step] || viewPortada)();
    body.append(MCR.ui.gameFlow(S.step === 'portada' || S.step === 'reglas' ? 0 : S.step === 'participantes' || S.step === 'equipos' ? 1 : 2));
    body.append(viewEl);

    /* La barra de acciones vive en el pie fijo: nunca tapa el contenido. */
    const bar = viewEl.querySelector(':scope > .action-bar');
    if (bar) foot.append(bar);
    MCR.ui.gameNavigation({ root, view: viewEl, foot, route: 'game:telefono', state: S, restore: (previous) => { S = previous; } });
  }

  /* ---------- portada ---------- */

  function viewPortada() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 01 · 2 equipos',
      title: 'Teléfono descompuesto',
      summary: 'Una película viaja por la fila en mímica, de persona en persona. Nadie habla hasta el final: la última persona intenta adivinar qué película era.',
      details: ['10 s de mímica por persona', 'Sin hablar ni hacer sonidos', 'La última persona adivina'],
      action: 'Ver reglas →',
      onContinue: () => { S.step = 'reglas'; MCR.go('game:telefono'); }
    });
  }

  /* ---------- guion ---------- */

  function viewReglas() {
    return MCR.ui.gameRulesPage({
      title: 'Teléfono descompuesto',
      headerSub: 'Puedes leerlo en voz alta tal cual.',
      goal: 'Que la película llegue intacta desde la primera persona de la fila hasta la última, usando solo mímica.',
      steps: [
        'Cada equipo forma una fila, todos de espaldas a quien va adelante. Juega un equipo y luego el otro, cada uno con su propia película.',
        'La primera persona ve la película en la tablet. Toca el hombro de quien sigue; esa persona se voltea y observa 10 segundos de mímica.',
        'Quien acaba de observar toca el hombro de la siguiente persona y repite, también en 10 segundos, lo que entendió. Así hasta el final de la fila.',
        'La última persona no actúa: dice en voz alta qué película cree que es, sin límite de tiempo. Después se revela la respuesta.'
      ],
      win: 'Gana el equipo que adivine su película. Si los dos aciertan es empate; si ninguno acierta, nadie gana.',
      facts: [['Equipos', '2 · mínimo 2 por equipo'], ['Mímica', '10 s por persona'], ['Quien adivina', 'Sin reloj']],
      special: [
        'No se vale hablar, hacer sonidos, señalar letras ni voltear antes del toque en el hombro.',
        'Al tocar «Cambio» arranca solo el reloj de 10 s de la siguiente persona. Si alguien termina antes, toca «Terminó antes».',
        'Si alguien tiene que salir, «🔄 Cambio» arriba a la derecha pone a otra persona en su lugar.',
        'Si hubo una interrupción, «Reiniciar reloj» repite la mímica de esa persona.',
        'Si alguien de la fila no está, omítelo justo antes de su turno.',
        'Quien llega tarde se suma en la pantalla de equipos, al equipo más corto.'
      ],
      onBack: () => { S.step = 'portada'; MCR.go('game:telefono'); },
      onContinue: () => { S.step = 'participantes'; MCR.go('game:telefono'); },
      action: 'Elegir participantes →',
      actionNote: 'Siguiente: participantes'
    });
  }

  function formTeams() {
    // Solo personas presentes: si alguien se marcó ausente después, no entra.
    const present = new Set(allIds());
    const ids = (S.picks && S.picks.length ? S.picks : allIds()).filter((id) => present.has(id));
    S.teams = MCR.store.makeTeams(ids, 2);
    S.chain = [S.teams[0].slice(), S.teams[1].slice()];
    S.guesser = S.chain.map((members) => members[members.length - 1] || null);
    S.order = [[], []];
    S.turn = 0;
    S.results = [null, null];
    S.titles = [];
    S.movie = null;
    S.idx = 0;
    S.timer = null;
    S.collapsed = [false, false];
    S.step = 'equipos';
    MCR.go('game:telefono');
  }

  /* ---------- equipos ---------- */

  function toggleActive(team, id) {
    const chain = S.chain[team];
    if (chain.includes(id)) {
      S.chain[team] = chain.filter((x) => x !== id);
      if (S.guesser[team] === id) S.guesser[team] = S.chain[team][0] || null;
    } else {
      S.chain[team] = chain.concat(id);
      if (!S.guesser[team]) S.guesser[team] = id;
    }
    updateTeamDom(team);
    refreshBalance();
  }

  /* Mueve de verdad: cambia el roster y, si participaba, la cadena. */
  function moveBetweenTeams(fromTeam, id) {
    const toTeam = fromTeam === 0 ? 1 : 0;
    const participates = S.chain[fromTeam].includes(id);
    const wasGuesser = S.guesser[fromTeam] === id;
    const name = MCR.store.nameOf(id);

    S.teams[fromTeam] = S.teams[fromTeam].filter((x) => x !== id);
    S.chain[fromTeam] = S.chain[fromTeam].filter((x) => x !== id);
    S.teams[toTeam].push(id);
    if (participates) S.chain[toTeam].push(id);

    if (wasGuesser) S.guesser[fromTeam] = S.chain[fromTeam][0] || null;
    if (participates && !S.guesser[toTeam]) S.guesser[toTeam] = id;

    MCR.go('game:telefono');
    MCR.ui.toast(name + ' pasó al ' + teamName(toTeam));
  }

  function toggleCollapse(team, collapsed) {
    S.collapsed[team] = collapsed;
    if (!rootEl) return;
    const board = rootEl.querySelector('[data-team-board="' + team + '"]');
    if (!board) return;
    const summary = board.querySelector('.team-collapsed-txt');
    if (summary) {
      summary.textContent = S.chain[team].length + ' de ' + S.teams[team].length + ' participan en la cadena.';
    }
  }

  /* Cambiar quién adivina no mueve ni reconstruye la lista. */
  function setGuesser(team, id) {
    if (!S.chain[team].includes(id)) return;
    S.guesser[team] = id;
    updateTeamDom(team);
  }

  function updateTeamDom(team) {
    if (!rootEl) return;
    const board = rootEl.querySelector('[data-team-board="' + team + '"]');
    if (!board) return;

    board.querySelectorAll('.player-row').forEach((row) => {
      const id = row.dataset.rowId;
      const participates = S.chain[team].includes(id);
      const isGuess = S.guesser[team] === id;
      row.classList.toggle('on', participates);
      row.classList.toggle('off', !participates);

      const chk = row.querySelector('.player-check');
      if (chk) chk.setAttribute('aria-pressed', String(participates));

      const gp = row.querySelector('.guess-pill');
      if (gp) {
        gp.disabled = !participates;
        gp.classList.toggle('on', isGuess);
        gp.setAttribute('aria-pressed', String(isGuess));
        gp.textContent = isGuess ? '★ Adivina' : '☆ Adivina';
      }

      const meta = row.querySelector('.player-meta');
      if (meta) meta.textContent = participates ? (isGuess ? '★ Adivina al final' : 'En la cadena') : 'No participa · toca ✓';
    });

    const count = board.querySelector('[data-team-count]');
    if (count) count.textContent = S.chain[team].length + '/' + S.teams[team].length;

    const guess = board.querySelector('[data-team-guesser="' + team + '"]');
    if (guess) guess.textContent = S.guesser[team] ? '★ ' + MCR.store.nameOf(S.guesser[team]) : 'Sin elegir';
  }

  function balanceMessage(diff) {
    if (diff === 0) return 'Equipos parejos. Todo listo para empezar.';
    if (diff === 1) return 'Diferencia de 1: está bien para jugar.';
    if (diff === 2) return 'Están algo disparejos. Mueve 1 persona al equipo corto.';
    return 'Muy disparejos: mueve ' + Math.floor(diff / 2) + ' persona(s) al equipo corto.';
  }

  /* Balance + herramientas (componente compartido). En Teléfono, ✓ en cada fila
     decide quién juega ESTA ronda dentro de su equipo; por eso no hay «Todos /
     Ninguno» globales: solo aparece «Incluir a los N que descansan» cuando hay
     alguien fuera (dejar a todos fuera nunca es útil). */
  function balancePanel() {
    const a = S.chain[0].length;
    const b = S.chain[1].length;
    const resting = restingCount();
    return MCR.ui.teamBalance([a, b], ['Equipo 1', 'Equipo 2'], {
      message: balanceMessage(Math.abs(a - b)),
      onMix: remix,
      onRebalance: rebalance,
      onAdd: addTeamPlayer,
      extra: [h('button', {
        class: 'btn btn-quiet mini',
        'data-resting': '',
        'data-focus-key': 'team-resting',
        hidden: !resting,
        onclick: markAll
      }, restingLabel(resting))]
    });
  }

  function restingCount() {
    return S.teams[0].length + S.teams[1].length - S.chain[0].length - S.chain[1].length;
  }

  function restingLabel(n) {
    return '✓ Incluir ' + (n === 1 ? 'a quien descansa' : 'a los ' + n + ' que descansan');
  }

  /* Mezclar = repartir otra vez a quienes están hoy en los equipos (incluye a
     quien se sumó en esta pantalla). Quien descansaba sigue descansando. */
  function remix() {
    const resting = new Set(S.teams.flat().filter((id) => !S.chain[0].includes(id) && !S.chain[1].includes(id)));
    S.teams = MCR.store.makeTeams(S.teams.flat(), 2);
    S.chain = S.teams.map((members) => members.filter((id) => !resting.has(id)));
    S.guesser = S.chain.map((members) => members[members.length - 1] || null);
    MCR.go('game:telefono');
    MCR.ui.toast('Equipos mezclados');
  }

  function markAll() {
    S.chain = [S.teams[0].slice(), S.teams[1].slice()];
    // Conserva a quien ya adivinaba; solo elige uno si el equipo no tenía.
    S.guesser = S.chain.map((members, t) => (S.guesser[t] && members.includes(S.guesser[t])) ? S.guesser[t] : members[members.length - 1] || null);
    MCR.go('game:telefono');
  }

  function refreshBalance() {
    if (!rootEl) return;
    const a = S.chain[0].length;
    const b = S.chain[1].length;
    const diff = Math.abs(a - b);
    const total = a + b;

    const box = rootEl.querySelector('[data-balance]');
    if (box) {
      box.classList.remove('ok', 'warn', 'danger');
      box.classList.add(diff <= 1 ? 'ok' : diff === 2 ? 'warn' : 'danger');
      const c0 = box.querySelector('[data-bcount="0"]');
      const c1 = box.querySelector('[data-bcount="1"]');
      if (c0) c0.textContent = String(a);
      if (c1) c1.textContent = String(b);
      const b0 = box.querySelector('[data-bbar="0"]');
      const b1 = box.querySelector('[data-bbar="1"]');
      if (b0) b0.style.width = (total ? (a / total) * 100 : 50) + '%';
      if (b1) b1.style.width = (total ? (b / total) * 100 : 50) + '%';
      const msg = box.querySelector('[data-bmsg]');
      if (msg) msg.textContent = balanceMessage(diff);
      const fix = box.querySelector('[data-rebalance]');
      if (fix) fix.hidden = diff < 2;
      const rest = box.querySelector('[data-resting]');
      if (rest) { const n = restingCount(); rest.hidden = !n; rest.textContent = restingLabel(n); }
    }

    const ready = a >= 2 && b >= 2;
    const info = rootEl.querySelector('[data-ready-info]');
    if (info) {
      info.textContent = ready ? 'Todo listo para empezar' : 'Mínimo 2 por equipo';
      info.classList.toggle('ok', ready);
    }
    const start = rootEl.querySelector('[data-start]');
    if (start) {
      start.disabled = !ready;
      start.textContent = ready ? 'Empezar turno →' : 'Mínimo 2 por equipo';
    }
  }

  function rebalance() {
    const a = S.chain[0].length;
    const b = S.chain[1].length;
    let from = a > b ? 0 : 1;
    const to = from === 0 ? 1 : 0;
    let moves = Math.floor(Math.abs(a - b) / 2);
    if (!moves) return;

    const moved = [];
    while (moves > 0) {
      const pool = S.chain[from].filter((id) => id !== S.guesser[from]);
      if (!pool.length) break;
      const id = pool[pool.length - 1];
      S.chain[from] = S.chain[from].filter((x) => x !== id);
      S.teams[from] = S.teams[from].filter((x) => x !== id);
      S.teams[to].push(id);
      S.chain[to].push(id);
      moved.push(MCR.store.nameOf(id));
      moves -= 1;
    }

    if (moved.length) {
      if (!S.chain[from].includes(S.guesser[from])) S.guesser[from] = S.chain[from][0] || null;
      if (!S.guesser[to]) S.guesser[to] = S.chain[to][S.chain[to].length - 1] || null;
      /* Al reordenar, quienes sí juegan van primero y los desmarcados quedan al final. */
      S.teams = S.teams.map((members, team) => {
        const active = new Set(S.chain[team]);
        return members.filter((id) => active.has(id)).concat(members.filter((id) => !active.has(id)));
      });
      MCR.go('game:telefono');
      MCR.ui.toast('Movido: ' + moved.join(', '));
    }
  }

  function addTeamPlayer(p) {
    if (!S.picks.includes(p.id)) S.picks.push(p.id);
    const inTeam = S.teams.findIndex((members) => members.includes(p.id));
    if (inTeam >= 0) {
      if (!S.chain[inTeam].includes(p.id)) S.chain[inTeam].push(p.id);
      MCR.go('game:telefono');
      return;
    }
    const team = S.chain[0].length <= S.chain[1].length ? 0 : 1;
    S.teams[team].push(p.id);
    S.chain[team].push(p.id);
    if (!S.guesser[team]) S.guesser[team] = p.id;
    MCR.go('game:telefono');
    MCR.ui.toast(p.name + ' se unió al ' + teamName(team));
  }

  function playerRow(team, id) {
    const participates = S.chain[team].includes(id);
    const isGuess = S.guesser[team] === id;
    const name = MCR.store.nameOf(id);
    const dest = team === 0 ? 2 : 1;

    return MCR.ui.teamRow({
      id,
      team,
      on: participates,
      name,
      meta: participates ? (isGuess ? '★ Adivina al final' : 'En la cadena') : 'No participa · toca ✓',
      leading: h('button', {
        class: 'player-check',
        'aria-label': 'Participa ' + name,
        'aria-pressed': String(participates),
        'data-focus-key': 'participates-' + id,
        onclick: () => toggleActive(team, id)
      }, '✓'),
      actions: [
        h('button', {
          class: 'guess-pill' + (isGuess ? ' on' : ''),
          'aria-pressed': String(isGuess),
          'data-focus-key': 'guesser-' + id,
          disabled: !participates,
          title: 'Que ' + name + ' adivine al final',
          onclick: () => setGuesser(team, id)
        }, isGuess ? '★ Adivina' : '☆ Adivina'),
        h('button', {
          class: 'move-pill',
          title: 'Mover a ' + teamName(team === 0 ? 1 : 0),
          'aria-label': 'Mover a ' + name + ' al ' + teamName(team === 0 ? 1 : 0),
          'data-focus-key': 'move-' + id,
          onclick: () => moveBetweenTeams(team, id)
        }, '→', h('span', { class: 'move-label' }, ' E' + dest))
      ]
    });
  }

  function teamColumn(team) {
    const members = S.teams[team];
    const count = S.chain[team].length;
    const collapsed = S.collapsed[team];

    return MCR.ui.teamBoard({
      team,
      key: team,
      name: teamName(team),
      kicker: teamColor(team),
      count: count + '/' + members.length,
      rows: members.map((id) => playerRow(team, id)),
      empty: 'Este equipo está vacío. Añade jugadores abajo.',
      collapsed,
      onToggleCollapse: (collapsed) => toggleCollapse(team, collapsed),
      preview: members.map((id) => MCR.ui.initials(MCR.store.nameOf(id))),
      collapsedText: count + ' de ' + members.length + ' participan en la cadena.',
      footerLabel: 'Adivina',
      footer: h('span', { class: 'team-guesser', 'data-team-guesser': String(team) },
        S.guesser[team] ? '★ ' + MCR.store.nameOf(S.guesser[team]) : 'Sin elegir')
    });
  }

  function viewParticipantes() {
    if (!S.picks) S.picks = allIds();
    const total = MCR.store.players().length;
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Participantes',
        title: '¿Quiénes juegan?',
        sub: 'Vienen todas las personas presentes. Toca a quien vaya a descansar; después la app reparte al resto en dos equipos parejos. Mínimo 4.'
      }),
      MCR.ui.peoplePicker({
        mode: 'roster',
        gameId: 'telefono',
        ids: allIds(),
        selected: S.picks,
        min: 4,
        onChange: (ids) => { S.picks = ids; MCR.go('game:telefono'); },
        onAdd: (p) => {
          if (!S.picks.includes(p.id)) S.picks.push(p.id);
          MCR.go('game:telefono');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'reglas'; MCR.go('game:telefono'); },
        info: S.picks.length >= 4 ? S.picks.length + ' participantes' : 'Mínimo 4 participantes',
        ok: S.picks.length >= 4,
        disabled: S.picks.length < 4,
        next: formTeams,
        nextLabel: 'Formar equipos →'
      })
    );
  }

  function viewEquipos() {
    const ready = S.chain[0].length >= 2 && S.chain[1].length >= 2;

    return h('div', { class: 'teams-screen' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Preparación',
        title: 'Arma los equipos',
        sub: '✓ marca quién juega, ★ elige quién adivina al final de cada fila y la flecha cambia a alguien de equipo. Una diferencia de 1 persona está bien.'
      }),

      balancePanel(),

      h('div', { class: 'teams-board' }, teamColumn(0), teamColumn(1)),

      h('div', { class: 'action-bar game-step-actions' },
        h('button', { class: 'btn btn-ghost', onclick: () => { S.step = 'participantes'; MCR.go('game:telefono'); } }, '← Participantes'),
        h('div', { class: 'action-bar-info' + (ready ? ' ok' : ''), 'data-ready-info': '' },
          ready ? 'Todo listo para empezar' : 'Mínimo 2 por equipo'),
        h('button', {
          class: 'btn btn-gold btn-xl',
          'data-start': '',
          disabled: !ready,
          onclick: startGame
        }, ready ? 'Empezar turno →' : 'Mínimo 2 por equipo')
      )
    );
  }

  function startGame() {
    /* El orden de juego pone al adivina al final, pero la lista visible no se mueve. */
    S.order = S.chain.map((members, team) => {
      const g = S.guesser[team];
      if (!g || !members.includes(g)) return members.slice();
      return members.filter((id) => id !== g).concat(g);
    });
    MCR.store.rememberTeams('telefono', [S.chain[0].slice(), S.chain[1].slice()]);
    S.turn = 0;
    S.idx = 0;
    S.timer = null;
    S.results = [null, null];
    S.titles = [];
    S.step = 'pick';
    MCR.go('game:telefono');
  }

  /* ---------- elegir película ----------
     La película solo la ve quien empieza la fila. Quien conduce puede elegirla de la
     lista (si salió de un papelito) o pedir una al azar sin verla. Se marca como usada
     al elegirla para que el otro equipo y las revanchas reciban otra distinta. */

  function chooseMovie(m) {
    S.movie = m;
    S.titles[S.turn] = m.title;
    MCR.store.markUsed('movies', m.id);
    S.idx = 0;
    S.timer = MCR.ui.newTimer(TURN_SECONDS);
    S.step = 'relay';
    MCR.go('game:telefono');
  }

  function viewPick() {
    const movies = MCR.store.get().content.movies;
    const usedSet = new Set(MCR.store.used('movies'));
    const available = movies.filter((m) => !usedSet.has(m.id));

    const grid = h('div', { class: 'movie-grid' });
    let showUsed = false;

    function paint() {
      MCR.ui.clear(grid);
      movies.forEach((m, i) => {
        const isUsed = usedSet.has(m.id);
        if (isUsed && !showUsed) return;
        grid.append(h('button', {
          class: 'movie-card' + (isUsed ? ' used' : ''),
          onclick: () => chooseMovie(m)
        },
          h('div', { class: 'mc-n' }, String(i + 1).padStart(2, '0')),
          h('div', { class: 'mc-t' }, m.title)
        ));
      });
      if (!grid.children.length) {
        grid.append(h('div', { class: 'empty' }, 'Ya se usaron todas las películas. Toca «Mostrar usadas», reinicia el mazo en Ajustes o agrega más en Contenido.'));
      }
    }
    paint();

    const order = S.order[S.turn];
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Turno · ' + teamName(S.turn),
        title: 'Película para el ' + teamName(S.turn),
        sub: 'Empieza ' + MCR.store.nameOf(order[0]) + ' y adivina ' + MCR.store.nameOf(order[order.length - 1]) + '. Pide una al azar para que nadie más la vea, o toca la que salió en el papelito.'
      }),
      h('details', { class: 'panel movie-list-panel' },
        h('summary', null, 'Elegir de la lista (' + available.length + ' disponibles)'),
        h('div', { class: 'row spread list-tools' },
          h('span', { class: 'tiny' }, (movies.length - available.length) + ' de ' + movies.length + ' ya usadas'),
          h('button', {
            class: 'btn btn-quiet mini',
            onclick: (e) => { showUsed = !showUsed; e.currentTarget.textContent = showUsed ? 'Ocultar usadas' : 'Mostrar usadas'; paint(); }
          }, 'Mostrar usadas')
        ),
        grid
      ),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, available.length ? 'Solo ' + MCR.store.nameOf(order[0]) + ' debe verla' : 'No quedan películas sin usar'),
        h('button', {
          class: 'btn btn-gold btn-xl',
          disabled: !available.length,
          onclick: () => chooseMovie(available[Math.floor(Math.random() * available.length)])
        }, '🎲 Película al azar')
      )
    );
  }

  /* ---------- cadena de mímica ----------
     Con N personas en la fila hay N − 1 mímicas. En la mímica k actúa order[k] y
     observa order[k + 1]. La última persona (quien adivina) nunca actúa ni tiene
     reloj: solo dice su respuesta en la pantalla siguiente. */

  function viewRelay() {
    const order = S.order[S.turn];
    const total = order.length - 1;           // número de mímicas
    const actor = order[S.idx];
    const watcher = order[S.idx + 1];
    const lastMime = S.idx === total - 1;      // quien observa es quien adivina
    if (!S.timer) S.timer = MCR.ui.newTimer(TURN_SECONDS);
    const t = S.timer;

    const advance = () => {
      if (S.ctrl) { S.ctrl.stop(); S.ctrl = null; }
      if (lastMime) S.step = 'answer';
      else {
        /* «Cambio»: la siguiente mímica arranca sola con sus 10 s. */
        S.idx += 1;
        S.timer = MCR.ui.newTimer(TURN_SECONDS);
        S.timer.status = 'running';
      }
      MCR.go('game:telefono');
    };

    const timer = MCR.ui.timerView(S, t, {
      route: 'game:telefono',
      startLabel: '▶ Iniciar mímica · ' + TURN_SECONDS + ' s'
    });

    let statusText;
    if (t.status === 'idle') {
      statusText = S.idx === 0
        ? MCR.store.nameOf(actor) + ' ve la película, toca el hombro de ' + MCR.store.nameOf(watcher) + ' y empieza cuando se voltee.'
        : MCR.store.nameOf(actor) + ' toca el hombro de ' + MCR.store.nameOf(watcher) + ' y repite lo que entendió.';
    } else if (t.status === 'running') statusText = '¡Mímica! Sin hablar, sin sonidos y sin señalar letras.';
    else if (t.status === 'paused') statusText = 'Reloj en pausa. Reanuda cuando estén listos.';
    else statusText = lastMime
      ? '¡Tiempo! Ahora ' + MCR.store.nameOf(watcher) + ' dice qué película cree que es.'
      : '¡Tiempo! ' + MCR.store.nameOf(watcher) + ' sigue con la siguiente persona.';

    /* Si quien sigue en la fila no está, se le omite (nunca a quien adivina ni dejando
       la fila con menos de 2 personas). */
    const canSkip = t.status === 'idle' && !lastMime && order.length > 2;
    const skipBtn = canSkip ? h('button', {
      class: 'btn btn-quiet mini',
      onclick: () => {
        const name = MCR.store.nameOf(watcher);
        S.order[S.turn] = order.filter((id, i) => i !== S.idx + 1);
        MCR.go('game:telefono');
        MCR.ui.toast(name + ' se omitió en esta cadena');
      }
    }, 'Falta ' + MCR.store.nameOf(watcher) + ' · omitir') : null;

    const movieBtn = S.idx === 0 && t.status === 'idle'
      ? h('button', {
          class: 'btn btn-ghost btn-xl movie-reveal-btn',
          onclick: () => MCR.ui.reveal({
            kicker: 'Solo para ' + MCR.store.nameOf(actor) + ' · que nadie más mire',
            title: S.movie.title,
            note: 'Memorízala y haz la mímica en 10 segundos'
          })
        }, '👁 Mostrar película a ' + MCR.store.nameOf(actor))
      : null;

    let action;
    if (t.status === 'done') {
      action = h('button', { class: 'btn btn-gold btn-xl', onclick: advance }, lastMime ? 'Escuchar respuesta →' : '🔄 Cambio · arranca ' + TURN_SECONDS + ' s');
    } else if (t.status === 'running' || t.status === 'paused') {
      action = h('button', { class: 'btn btn-ghost', onclick: advance }, lastMime ? 'Terminó antes →' : 'Terminó antes · cambio →');
    }

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage relay-stage' },
        h('div', { class: 'turn-badge' }, teamName(S.turn) + ' · mímica ' + (S.idx + 1) + ' de ' + total),
        h('div', { class: 'relay-pair' },
          h('div', { class: 'relay-person actor' },
            h('span', { class: 'relay-role' }, 'Hace la mímica'),
            h('span', { class: 'relay-name' }, MCR.store.nameOf(actor))
          ),
          h('span', { class: 'relay-arrow', 'aria-hidden': 'true' }, '→'),
          h('div', { class: 'relay-person watcher' },
            h('span', { class: 'relay-role' }, lastMime ? 'Observa y luego adivina' : 'Observa'),
            h('span', { class: 'relay-name' }, MCR.store.nameOf(watcher))
          )
        ),
        timer.ring,
        h('div', { class: 'stage-note' }, statusText),
        h('div', { class: 'row center-row hide-in-visual' }, movieBtn, skipBtn),
        h('ol', { class: 'chain-track hide-in-visual', 'aria-label': 'Orden de la fila' }, order.map((cid, i) =>
          h('li', { class: 'chain-dot' + (i < S.idx ? ' done' : '') + (i === S.idx ? ' actor' : '') + (i === S.idx + 1 ? ' watcher' : '') + (i === order.length - 1 ? ' guess' : '') },
            h('span', { class: 'chain-dot-n' }, i === order.length - 1 ? '★' : String(i + 1)),
            h('span', { class: 'chain-dot-name' }, MCR.store.nameOf(cid))
          )
        ))
      ),
      h('div', { class: 'action-bar' }, timer.controls, action)
    );
  }

  /* ---------- respuesta (sin reloj) ---------- */

  function viewAnswer() {
    const order = S.order[S.turn];
    const guesser = order[order.length - 1];
    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage' },
        h('div', { class: 'turn-badge' }, teamName(S.turn) + ' · respuesta'),
        h('div', { class: 'stage-label' }, 'Adivina'),
        h('div', { class: 'stage-word name' }, MCR.store.nameOf(guesser)),
        h('div', { class: 'stage-note' }, 'Di en voz alta qué película crees que es. Sin prisa: tu equipo no puede ayudarte.')
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-gold btn-xl', onclick: () => { S.step = 'revelar'; MCR.go('game:telefono'); } }, 'Ya respondió · revelar →')
      )
    );
  }

  /* ---------- revelar ---------- */

  function viewRevelar() {
    const m = S.movie;
    const close = (guessed) => {
      S.results[S.turn] = guessed;
      if (S.turn === 0) {
        S.turn = 1;
        S.movie = null;
        S.idx = 0;
        S.timer = null;
        S.step = 'pick';
      } else {
        S.step = 'resultado';
      }
      MCR.go('game:telefono');
    };

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage' },
        h('div', { class: 'turn-badge' }, teamName(S.turn) + ' · respuesta final'),
        h('div', { class: 'stage-label' }, 'La película era'),
        h('div', { class: 'stage-word big' }, m.title),
        h('div', { class: 'stage-note' }, '¿La respuesta coincide con la película?')
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-danger btn-xl', onclick: () => close(false) }, '✕ No adivinó'),
        h('button', { class: 'btn btn-ok btn-xl', onclick: () => close(true) }, '✓ Sí adivinó')
      )
    );
  }

  /* ---------- resultado ---------- */

  /* Revancha con los mismos equipos: adivina quien antes empezaba la fila, para que
     el papel más visible rote en lugar de recaer siempre en la misma persona. */
  function again() {
    const nextGuesser = S.order.map((order) => order[0] || null);
    S.guesser = nextGuesser.map((id, team) => (id && S.chain[team].includes(id)) ? id : S.guesser[team]);
    S.results = [null, null];
    S.titles = [];
    S.movie = null;
    S.turn = 0;
    S.idx = 0;
    S.timer = null;
    S.step = 'equipos';
  }

  function viewResultado() {
    const ok = S.results.map((r) => r === true);
    const winner = ok[0] && ok[1] ? 'empate' : ok[0] ? 0 : ok[1] ? 1 : 'nadie';

    const winners = [];
    if (ok[0]) S.order[0].forEach((id) => winners.push(id));
    if (ok[1]) S.order[1].forEach((id) => winners.push(id));

    const side = (i) => h('div', { class: 'score-side' + (ok[i] ? ' win' : '') },
      h('div', { class: 'score-n' }, ok[i] ? '✓' : '✕'),
      h('div', { class: 'score-l' }, teamName(i) + ' · ' + (ok[i] ? 'adivinó' : 'no adivinó')),
      h('div', { class: 'score-meta' }, S.titles[i] || '')
    );

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'result-head' },
        h('div', { class: 'eyebrow' }, 'Fin del juego'),
        h('h2', { class: 'result-title' },
          winner === 'empate' ? '¡Empate! Los dos adivinaron' : winner === 'nadie' ? 'Nadie adivinó…' : teamName(winner) + ' gana')
      ),
      h('div', { class: 'score' }, side(0), h('div', { class: 'score-vs' }, 'VS'), side(1)),
      MCR.ui.finishBar({
        route: 'game:telefono',
        event: () => ({
          gameId: 'telefono',
          playerIds: MCR.ui.withSwapped(S, [].concat(S.order[0], S.order[1])),
          winners,
          meta: { results: S.results.slice(), movies: S.titles.slice(), chains: [S.order[0].slice(), S.order[1].slice()] }
        }),
        again,
        againLabel: 'Registrar y revancha',
        reset
      })
    );
  }

  MCR.screens['game:telefono'] = render;
})();
