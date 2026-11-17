window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 06 — Sándwich de letras
   Dos equipos · par de letras · puntos · tiempo

   Es una carrera: los dos equipos ven el mismo par de letras y el primero que
   dice una palabra válida gana el punto. S.log guarda el orden de los puntos para
   poder deshacer el último si se tocó el equipo equivocado. Si al terminar el
   reloj hay empate, se juega un par de desempate sin reloj (S.tiebreak = equipo).
   ========================================================= */

(function () {
  const { h } = MCR.ui;

  let S = null;
  let rootEl = null;

  function reset() {
    S = {
      step: 'intro',
      picks: [],
      active: null,
      teams: [[], []],
      seconds: 60,
      deck: [],
      idx: 0,
      score: [0, 0],
      pair: null,
      ctrl: null,
      rounds: 0,
      log: [],          // equipos que anotaron, en orden (para «Deshacer último punto»)
      timer: null,
      tiebreak: null,   // equipo que ganó el par de desempate
      collapsed: [false, false]
    };
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
      title: 'Sándwich de letras',
      sub: 'Letra inicial y final · Juego 06',
      backTo: 'home',
      swap: { S, route: 'game:sandwich', gameId: 'sandwich', steps: ['play', 'tiebreak'], ids: () => [].concat(...(S.teams || [])) }
    });
    root.append(g);

    const views = { intro: viewIntro, rules: viewRules, participantes: viewParticipantes, setup: viewSetup, play: viewPlay, tiebreak: viewTiebreak, end: viewEnd };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : S.step === 'participantes' || S.step === 'setup' ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:sandwich', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 06',
      title: 'Sándwich de letras',
      summary: 'Aparecen dos letras: la primera y la última de una palabra. El primer equipo que grite una palabra que encaje en ese «sándwich» gana el punto.',
      details: ['2 equipos', 'Carrera contra el reloj', '1 punto por palabra'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:sandwich'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Sándwich de letras',
      goal: 'Que tu equipo encuentre más palabras «sándwich»: que empiecen con una letra y terminen con otra.',
      steps: [
        'Se forman dos equipos y se fija la duración de la ronda.',
        'Al iniciar el reloj aparece un par de letras: la inicial y la final de la palabra que hay que encontrar.',
        'Los dos equipos compiten al mismo tiempo. El primero que diga en voz alta una palabra válida gana el punto y aparece un par nuevo.',
        'Si nadie encuentra palabra, quien conduce toca «Saltar par» y aparece otro. Se juega hasta que termina el reloj.'
      ],
      win: 'Gana el equipo con más puntos. Si empatan, se juega un par de desempate sin reloj: el primer equipo que acierte gana.',
      facts: [['Equipos', '2 · mínimo 1 por equipo'], ['Ronda', 'Duración a elegir'], ['Punto', '1 por palabra válida']],
      special: [
        'Si sumaste el punto al equipo equivocado, «Deshacer último punto» lo corrige.',
        '«Pausar» detiene el reloj sin perder el marcador.',
        'Los pares usados no se repiten hasta agotar el mazo.',
        'Quien llega tarde se suma en la pantalla de equipos, al equipo más corto.'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:sandwich'); },
      onContinue: () => { S.step = 'participantes'; MCR.go('game:sandwich'); }
    });
  }

  /* ---------- setup ---------- */

  function allIds() { return MCR.store.players().map((p) => p.id); }

  function autoTeams() {
    const present = new Set(allIds());
    const ids = (S.active ? S.active : allIds()).filter((id) => present.has(id));
    const t = MCR.store.makeTeams(ids, 2);
    S.teams = [t[0].slice(), t[1].slice()];
    if (S.teams[0].length || S.teams[1].length) MCR.store.rememberTeams('sandwich', S.teams);
  }

  function toggleActive(id) {
    if (S.active.includes(id)) {
      S.active = S.active.filter((x) => x !== id);
      S.teams = [S.teams[0].filter((x) => x !== id), S.teams[1].filter((x) => x !== id)];
    } else {
      S.active = S.active.concat(id);
      const team = S.teams[0].length <= S.teams[1].length ? 0 : 1;
      S.teams[team].push(id);
    }
    MCR.go('game:sandwich');
  }

  function movePlayer(id) {
    const from = S.teams[0].includes(id) ? 0 : 1;
    const to = from === 0 ? 1 : 0;
    S.teams[from] = S.teams[from].filter((x) => x !== id);
    S.teams[to].push(id);
  }

  function rebalanceTeams() {
    while (Math.abs(S.teams[0].length - S.teams[1].length) >= 2) {
      const from = S.teams[0].length > S.teams[1].length ? 0 : 1;
      const id = S.teams[from][S.teams[from].length - 1];
      movePlayer(id);
    }
    MCR.store.rememberTeams('sandwich', S.teams);
    MCR.go('game:sandwich');
  }

  function teamBox(i) {
    const rows = S.teams[i].map((id) => MCR.ui.teamRow({
      id,
      team: i,
      variant: 'plain',
      name: MCR.store.nameOf(id),
      meta: MCR.ui.playerMeta(id, 'sandwich'),
      actions: [
        h('button', {
          class: 'move-pill',
          title: 'Mover al Equipo ' + (i === 0 ? 2 : 1),
          'aria-label': 'Mover a ' + MCR.store.nameOf(id) + ' al Equipo ' + (i === 0 ? 2 : 1),
          'data-focus-key': 'move-' + id,
          onclick: () => {
            movePlayer(id);
            MCR.ui.toast(MCR.store.nameOf(id) + ' pasó al Equipo ' + (i === 0 ? 2 : 1));
            MCR.go('game:sandwich');
          }
        }, '→', h('span', { class: 'move-label' }, ' E' + (i === 0 ? 2 : 1)))
      ]
    }));

    return MCR.ui.teamBoard({
      team: i,
      key: i,
      name: 'Equipo ' + (i + 1),
      kicker: i === 0 ? 'Azul' : 'Rojo',
      count: S.teams[i].length + ' jugadores',
      rows,
      empty: 'Sin jugadores',
      collapsed: !!S.collapsed[i],
      onToggleCollapse: (collapsed) => { S.collapsed[i] = collapsed; },
      preview: S.teams[i].map((id) => MCR.ui.initials(MCR.store.nameOf(id))),
      collapsedText: S.teams[i].length + ' jugadores en este equipo.'
    });
  }

  function addTeamPlayer(player) {
    if (!S.active.includes(player.id)) S.active.push(player.id);
    if (S.teams[0].includes(player.id) || S.teams[1].includes(player.id)) return MCR.go('game:sandwich');
    const team = S.teams[0].length <= S.teams[1].length ? 0 : 1;
    S.teams[team].push(player.id);
    MCR.store.rememberTeams('sandwich', S.teams);
    MCR.go('game:sandwich');
  }

  function viewParticipantes() {
    if (S.active == null) S.active = allIds();
    const active = S.active;
    const total = MCR.store.players().length;
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Participantes',
        title: '¿Quiénes juegan?',
        sub: 'Vienen todas las personas presentes. Toca a quien vaya a descansar; después se reparte al resto en dos equipos.'
      }),
      MCR.ui.peoplePicker({
        mode: 'roster',
        gameId: 'sandwich',
        ids: allIds(),
        selected: active,
        min: 2,
        onChange: (ids) => { S.active = ids; MCR.go('game:sandwich'); },
        onAdd: (p) => {
          if (!S.active.includes(p.id)) S.active.push(p.id);
          MCR.go('game:sandwich');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:sandwich'); },
        info: active.length >= 2 ? active.length + ' participantes' : 'Mínimo 2 participantes',
        ok: active.length >= 2,
        disabled: active.length < 2,
        next: () => { autoTeams(); S.step = 'setup'; MCR.go('game:sandwich'); },
        nextLabel: 'Formar equipos →'
      })
    );
  }

  function viewSetup() {
    if (S.active == null) S.active = allIds();
    if (!S.teams[0].length && !S.teams[1].length) autoTeams();

    const active = S.active;
    const total = MCR.store.players().length;

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Equipos',
        title: 'Reparte a los equipos',
        sub: 'Mueve a quien quieras con la flecha, mezcla de nuevo o reequilibra. La app intenta no repetir compañeros de juegos anteriores.'
      }),
      MCR.ui.teamBalance([S.teams[0].length, S.teams[1].length], ['Equipo 1', 'Equipo 2'], {
        onMix: () => { autoTeams(); MCR.go('game:sandwich'); MCR.ui.toast('Equipos mezclados'); },
        onRebalance: rebalanceTeams,
        onAdd: addTeamPlayer
      }),
      h('div', { class: 'teams-board' }, teamBox(0), teamBox(1)),
      MCR.ui.durationPicker({
        title: 'Duración de la ronda', value: S.seconds,
        onChange: (seconds) => { S.seconds = seconds; },
        onValidityChange: (valid) => {
          rootEl.querySelector('.game-foot .btn-gold').disabled = !valid || !S.teams[0].length || !S.teams[1].length;
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'participantes'; MCR.go('game:sandwich'); },
        info: S.teams[0].length && S.teams[1].length ? 'Equipos listos' : 'Cada equipo necesita al menos una persona',
        ok: !!(S.teams[0].length && S.teams[1].length),
        disabled: !S.teams[0].length || !S.teams[1].length,
        next: () => {
          MCR.store.rememberTeams('sandwich', S.teams);
          startRound();
        },
        nextLabel: 'Ir a la ronda →'
      })
    );
  }

  /* ---------- mazo de letras ----------
     Los pares se marcan como usados al resolverse (punto o salto), no al mostrarse,
     para que un par que quedó en pantalla al terminar el reloj pueda volver a salir. */

  function buildDeck() {
    const all = MCR.store.get().content.letterPairs;
    const used = new Set(MCR.store.used('letterPairs'));
    let pool = all.filter((p) => !used.has(p.id));
    if (pool.length < 6) {
      MCR.store.resetUsed('letterPairs');
      pool = all.slice();
    }
    S.deck = MCR.store.shuffle(pool);
    S.idx = 0;
  }

  function nextPair() {
    if (S.idx >= S.deck.length) buildDeck();
    S.pair = S.deck[S.idx++] || null;
  }

  function resolvePair() {
    if (S.pair) MCR.store.markUsed('letterPairs', S.pair.id);
    nextPair();
  }

  function startRound() {
    S.score = [0, 0];
    S.rounds = 0;
    S.log = [];
    S.tiebreak = null;
    buildDeck();
    nextPair();
    S.timer = MCR.ui.newTimer(S.seconds);
    S.step = 'play';
    MCR.go('game:sandwich');
  }

  function scoreBoard(winner) {
    const side = (i) => h('div', { class: 'score-side' + (winner === i ? ' win' : '') },
      h('div', { class: 'score-n' }, String(S.score[i])),
      h('div', { class: 'score-l' }, 'Equipo ' + (i + 1)),
      S.tiebreak === i ? h('div', { class: 'score-meta' }, '+ desempate') : null
    );
    return h('div', { class: 'score' }, side(0), h('div', { class: 'score-vs' }, 'VS'), side(1));
  }

  /* ---------- jugar ---------- */

  function viewPlay() {
    if (!S.timer) S.timer = MCR.ui.newTimer(S.seconds);
    const t = S.timer;
    const live = t.status === 'running';
    const timer = MCR.ui.timerView(S, t, {
      route: 'game:sandwich',
      onEnd: () => { S.step = S.score[0] === S.score[1] ? 'tiebreak' : 'end'; MCR.go('game:sandwich'); }
    });

    const point = (i) => {
      S.score[i] += 1;
      S.rounds += 1;
      S.log.push(i);
      resolvePair();
      MCR.go('game:sandwich');
    };
    const undo = () => {
      const i = S.log.pop();
      if (i == null) return;
      S.score[i] = Math.max(0, S.score[i] - 1);
      S.rounds = Math.max(0, S.rounds - 1);
      MCR.go('game:sandwich');
      MCR.ui.toast('Se quitó el último punto del Equipo ' + (i + 1));
    };

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage sandwich-stage' },
        h('div', { class: 'stage-label' }, 'Empieza con … termina con'),
        h('div', { class: 'stage-word letters' + (t.status === 'idle' ? ' veiled' : '') },
          h('span', null, S.pair ? S.pair.a : '?'), h('i', { 'aria-hidden': 'true' }, '…'), h('span', null, S.pair ? S.pair.b : '?')),
        timer.ring,
        t.status === 'idle' ? h('div', { class: 'stage-note' }, 'El par se revela al iniciar el reloj.') : null
      ),
      h('div', { class: 'duel-actions' },
        h('button', { class: 'btn btn-blue btn-xl', disabled: !live, onclick: () => point(0) }, '+1 Equipo 1'),
        h('button', { class: 'btn btn-red btn-xl', disabled: !live, onclick: () => point(1) }, '+1 Equipo 2')
      ),
      h('div', { class: 'play-tools' },
        h('button', { class: 'btn btn-ghost mini', disabled: !live, onclick: () => { resolvePair(); MCR.go('game:sandwich'); } }, 'Nadie la encuentra · saltar par'),
        S.log.length ? h('button', { class: 'btn btn-ghost mini', onclick: undo }, '↶ Deshacer último punto') : null
      ),
      scoreBoard(S.score[0] === S.score[1] ? null : S.score[0] > S.score[1] ? 0 : 1),
      h('div', { class: 'action-bar' }, timer.controls)
    );
  }

  /* ---------- desempate ---------- */

  function viewTiebreak() {
    const win = (i) => { S.tiebreak = i; S.step = 'end'; MCR.go('game:sandwich'); };
    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage sandwich-stage' },
        h('div', { class: 'turn-badge' }, 'Empate ' + S.score[0] + ' — ' + S.score[1] + ' · par de desempate'),
        h('div', { class: 'stage-word letters' },
          h('span', null, S.pair ? S.pair.a : '?'), h('i', { 'aria-hidden': 'true' }, '…'), h('span', null, S.pair ? S.pair.b : '?')),
        h('div', { class: 'stage-note' }, 'Sin reloj. El primer equipo que diga una palabra válida gana.')
      ),
      h('div', { class: 'duel-actions' },
        h('button', { class: 'btn btn-blue btn-xl', onclick: () => win(0) }, 'Ganó Equipo 1'),
        h('button', { class: 'btn btn-red btn-xl', onclick: () => win(1) }, 'Ganó Equipo 2')
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-ghost', onclick: () => { resolvePair(); MCR.go('game:sandwich'); } }, 'Nadie la encuentra · otro par'),
        h('button', { class: 'btn btn-ghost', onclick: () => { S.step = 'end'; MCR.go('game:sandwich'); } }, 'Dejar en empate')
      )
    );
  }

  /* ---------- fin ---------- */

  function viewEnd() {
    const a = S.score[0];
    const b = S.score[1];
    const winner = a !== b ? (a > b ? 0 : 1) : S.tiebreak;

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'result-head' },
        h('div', { class: 'eyebrow' }, '¡Tiempo!'),
        h('h2', { class: 'result-title' },
          winner == null ? '¡Empate!' : 'Gana el Equipo ' + (winner + 1) + (S.tiebreak != null ? ' en el desempate' : ''))
      ),
      scoreBoard(winner),
      h('p', { class: 'roster-note center' }, S.rounds + (S.rounds === 1 ? ' palabra encontrada' : ' palabras encontradas') + '. Los pares usados no vuelven a salir hasta agotar el mazo.'),
      MCR.ui.finishBar({
        route: 'game:sandwich',
        event: () => ({
          gameId: 'sandwich',
          playerIds: [].concat(S.teams[0], S.teams[1]),
          winners: winner == null ? [] : S.teams[winner].slice(),
          meta: { score: S.score.slice(), rounds: S.rounds, tiebreak: S.tiebreak }
        }),
        // Revancha con los mismos equipos y la misma duración.
        again: () => { S.step = 'setup'; S.score = [0, 0]; S.log = []; S.tiebreak = null; S.timer = null; },
        againLabel: 'Registrar y revancha',
        reset
      })
    );
  }

  MCR.screens['game:sandwich'] = render;
})();
