window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 04 — Cascarón Piratas
   Dos filas · "¡Piratas!" · el que pierde vuelve a formarse

   Mecánica (resolve): se enfrentan left[0] y right[0]. Quien gana sale a
   S.saved y ya no vuelve; quien pierde vuelve al FINAL DE SU PROPIA fila. Si una
   fila queda vacía, normalize() pasa al ÚLTIMO de la otra fila a ser el primero de
   la fila vacía (no se reparte a nadie más). Termina cuando queda
   una sola persona (S.loser, «gran perdedor»). Se registran como ganadores solo
   los invictos (se salvaron sin perder ningún duelo).
   Durante los duelos se puede retirar a alguien (✕) o sumar a quien llega tarde
   (va al final de la fila más corta) sin reiniciar la partida.
   ========================================================= */

(function () {
  const { h } = MCR.ui;

  let S = null;

  function reset() {
    S = {
      step: 'intro', active: null, left: [], right: [], saved: [], losses: {},
      loser: null, history: [], round: 0, collapsed: { left: false, right: false }
    };
  }

  function render(root) {
    if (!S || root.dataset.newEntry === 'true') reset();
    root.dataset.view = S.step;
    const { root: g, body, foot } = MCR.ui.shell({
      title: 'Cascarón Piratas',
      sub: 'Piedra, papel o tijera · Juego 04',
      backTo: 'home',
      swap: { S, route: 'game:cascaron', gameId: 'cascaron', steps: ['duel'], ids: () => [].concat(S.left || [], S.right || []) }
    });
    root.append(g);

    const views = { intro: viewIntro, rules: viewRules, setup: viewSetup, teams: viewTeams, duel: viewDuel, end: viewEnd };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : S.step === 'setup' || S.step === 'teams' ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:cascaron', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 04',
      title: 'Cascarón Piratas',
      summary: 'Duelos de piedra, papel o tijera al grito de «¡Piratas!». Quien gana se salva; quien pierde vuelve a la fila. La última persona en riesgo se lleva el cascarón.',
      details: ['Juega todo el grupo', 'Duelos 1 contra 1', 'Termina cuando queda 1'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:cascaron'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Cascarón Piratas',
      script: '¡Dos filas, frente a frente! Las primeras personas de cada fila se enfrentan a piedra, papel o tijera, pero gritando «¡Pi-ra-tas!». Quien gana se salva; quien pierde se va al final de su fila a esperar otra oportunidad. Y la última persona que quede… ¡se lleva el cascarón!',
      origin: 'Inspirado en «¡Échale huevos!» del programa.',
      goal: 'Salvarte ganando un duelo antes de que te conviertas en la última persona en riesgo.',
      steps: [
        'El grupo se divide en dos filas, una frente a la otra.',
        'Pasan al frente las primeras personas de cada fila y juegan piedra, papel o tijera diciendo «¡Pi-ra-tas!» en lugar de «piedra, papel o tijera».',
        'Quien gana queda a salvo y sale de la fila. Quien pierde vuelve al final de su propia fila y espera otro duelo.',
        'Si una fila se queda vacía, el último de la otra fila pasa a ser el primero de la fila vacía. Se sigue hasta que solo quede una persona.'
      ],
      win: 'La última persona en riesgo es el gran perdedor y le toca el cascarón. Quienes se salvaron sin perder ningún duelo terminan invictos y suman una victoria.',
      facts: [['Participan', 'Todo el grupo · mínimo 2'], ['Duelo', '1 contra 1'], ['Termina', 'Cuando queda 1']],
      special: [
        'Si sacan lo mismo, repiten el duelo; no se registra nada.',
        'Si alguien tiene que irse, retíralo de su fila con ✕.',
        'Quien llega tarde se suma al final de la fila más corta.',
        'Si tocaste el ganador equivocado, usa «← Atrás».'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:cascaron'); },
      onContinue: () => { S.step = 'setup'; MCR.go('game:cascaron'); }
    });
  }

  /* ---------- participantes ---------- */

  function allIds() { return MCR.store.players().map((p) => p.id); }

  function viewSetup() {
    if (S.active == null) S.active = allIds();
    const active = S.active;
    const total = MCR.store.players().length;
    const ready = active.length >= 2;

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Preparación',
        title: '¿Quiénes participan?',
        sub: 'Vienen todas las personas presentes. Toca a quien vaya a descansar; las filas se forman con el resto.'
      }),
      MCR.ui.peoplePicker({
        mode: 'roster',
        gameId: 'cascaron',
        ids: allIds(),
        selected: active,
        min: 2,
        onChange: (ids) => { S.active = ids; MCR.go('game:cascaron'); },
        onAdd: (p) => {
          if (!S.active.includes(p.id)) S.active.push(p.id);
          MCR.go('game:cascaron');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:cascaron'); },
        info: ready ? active.length + ' participantes' : 'Mínimo 2 participantes',
        ok: ready,
        disabled: !ready,
        next: () => { formTeams(); MCR.go('game:cascaron'); },
        nextLabel: 'Formar filas →'
      })
    );
  }

  /* ---------- equipos ---------- */

  function formTeams() {
    const present = new Set(allIds());
    const ids = ((S.active && S.active.length) ? S.active : allIds()).filter((id) => present.has(id));
    const teams = MCR.store.makeTeams(ids, 2);
    S.left = teams[0].slice();
    S.right = teams[1].slice();
    S.saved = [];
    S.losses = {};
    S.history = [];
    S.round = 0;
    S.loser = null;
    S.collapsed = { left: false, right: false };
    S.step = 'teams';
    MCR.store.rememberTeams('cascaron', teams);
  }

  /* «Mezclar» en la formación: reparte de nuevo a quienes están HOY en las filas
     (incluye a quien se sumó en esta pantalla), con el mismo criterio de makeTeams. */
  function mixQueues() {
    const ids = S.left.concat(S.right);
    const teams = MCR.store.makeTeams(ids, 2);
    S.left = teams[0].slice();
    S.right = teams[1].slice();
    MCR.store.rememberTeams('cascaron', teams);
  }

  function queueColumn(side, ids, opts) {
    opts = opts || {};
    const isLeft = side === 'left';
    const team = isLeft ? 0 : 1;
    const collapsed = !!S.collapsed[side];
    const rows = ids.map((id, i) => MCR.ui.teamRow({
      id,
      team,
      variant: 'queue',
      on: i === 0 ? true : null,
      name: MCR.store.nameOf(id),
      meta: i === 0 ? 'Turno actual' : 'En fila',
      leading: h('span', { class: 'player-pos' }, String(i + 1)),
      actions: opts.manage ? [h('button', {
        class: 'move-pill',
        title: 'Mover al otro equipo',
        'aria-label': 'Mover a ' + MCR.store.nameOf(id) + ' a la otra fila',
        onclick: () => moveQueuePlayer(side, id)
      }, '→', h('span', { class: 'move-label' }, ' otra fila'))] :
        [h('button', {
          class: 'move-pill retire-pill',
          title: 'Retirar a ' + MCR.store.nameOf(id) + ' (se tuvo que ir)',
          'aria-label': 'Retirar a ' + MCR.store.nameOf(id),
          onclick: () => retirePlayer(side, id)
        }, '✕')]
    }));

    return MCR.ui.teamBoard({
      team,
      key: side,
      emblem: isLeft ? '1' : '2',
      name: isLeft ? 'Fila izquierda' : 'Fila derecha',
      kicker: isLeft ? 'Azul' : 'Rojo',
      count: ids.length + ' en fila',
      rows,
      empty: 'Fila vacía',
      collapsed,
      compact: !!opts.compact,
      onToggleCollapse: (collapsed) => { S.collapsed[side] = collapsed; },
      preview: ids.map((id) => MCR.ui.initials(MCR.store.nameOf(id))),
      collapsedText: ids.length + ' en fila.',
      footerLabel: 'Siguiente',
      footer: h('span', { class: 'team-guesser' }, ids.length ? MCR.store.nameOf(ids[0]) : '—')
    });
  }

  function moveQueuePlayer(side, id) {
    const from = side === 'left' ? S.left : S.right;
    const to = side === 'left' ? S.right : S.left;
    if (from.length <= 1) {
      MCR.ui.toast('Cada fila necesita al menos una persona');
      return;
    }
    from.splice(from.indexOf(id), 1);
    to.push(id);
    MCR.store.rememberTeams('cascaron', [S.left, S.right]);
    MCR.go('game:cascaron');
    MCR.ui.toast(MCR.store.nameOf(id) + ' pasó a la otra fila');
  }

  /* Alguien se va a media partida: sale de su fila sin contar como derrota. */
  function retirePlayer(side, id) {
    const name = MCR.store.nameOf(id);
    S[side] = S[side].filter((x) => x !== id);
    S.retired = (S.retired || []).concat(id);
    normalize();
    if (S.left.length + S.right.length <= 1) {
      S.loser = S.left[0] || S.right[0] || null;
      S.step = 'end';
    }
    MCR.go('game:cascaron');
    MCR.ui.toast(name + ' se retiró del juego');
  }

  function rebalanceQueues() {
    while (Math.abs(S.left.length - S.right.length) >= 2) {
      const from = S.left.length > S.right.length ? S.left : S.right;
      const to = from === S.left ? S.right : S.left;
      to.push(from.pop());
    }
    MCR.store.rememberTeams('cascaron', [S.left, S.right]);
    MCR.go('game:cascaron');
  }

  function addQueuePlayer(player) {
    if (S.left.includes(player.id) || S.right.includes(player.id)) return MCR.go('game:cascaron');
    if (!S.active.includes(player.id)) S.active.push(player.id);
    S.saved = S.saved.filter((x) => x !== player.id);
    const side = S.left.length <= S.right.length ? S.left : S.right;
    side.push(player.id);
    MCR.store.rememberTeams('cascaron', [S.left, S.right]);
    MCR.go('game:cascaron');
  }

  function viewTeams() {
    if (!S.left.length && !S.right.length) formTeams();

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Formación · ' + (S.left.length + S.right.length) + ' jugadores',
        title: 'Dos filas, un cascarón',
        sub: 'Así se forman las filas. Usa la flecha para cambiar a alguien de fila; la primera persona de cada fila abre el primer duelo.'
      }),
      MCR.ui.teamBalance([S.left.length, S.right.length], ['Fila izquierda', 'Fila derecha'], {
        onMix: () => { mixQueues(); MCR.go('game:cascaron'); MCR.ui.toast('Filas mezcladas'); },
        onRebalance: rebalanceQueues,
        onAdd: addQueuePlayer
      }),
      h('div', { class: 'teams-board' }, queueColumn('left', S.left, { manage: true }), queueColumn('right', S.right, { manage: true })),
      MCR.ui.stepBar({
        back: () => { S.step = 'setup'; MCR.go('game:cascaron'); },
        backLabel: '← Participantes',
        info: 'Filas listas',
        ok: true,
        next: () => { S.step = 'duel'; MCR.go('game:cascaron'); },
        nextLabel: 'Comenzar duelos →'
      })
    );
  }

  /* ---------- duelo ---------- */

  /* Fila vacía: el último de la otra fila pasa a encabezarla. */
  function normalize() {
    if (S.left.length === 0 && S.right.length >= 2) S.left.push(S.right.pop());
    else if (S.right.length === 0 && S.left.length >= 2) S.right.push(S.left.pop());
  }

  function resolve(winnerSide) {
    const a = S.left[0];
    const b = S.right[0];
    const winner = winnerSide === 'left' ? a : b;
    const loser = winnerSide === 'left' ? b : a;

    S.losses[loser] = (S.losses[loser] || 0) + 1;
    S.saved.push(winner);
    S.history.push({ winner, loser, round: ++S.round });

    if (winnerSide === 'left') {
      S.left.shift();
      S.right.shift();
      S.right.push(loser);
    } else {
      S.left.shift();
      S.right.shift();
      S.left.push(loser);
    }

    const beforeL = S.left.length;
    const beforeR = S.right.length;
    normalize();
    const moved = beforeL === 0 && S.left.length ? S.left[0] : beforeR === 0 && S.right.length ? S.right[0] : null;

    if (S.left.length + S.right.length <= 1) {
      S.loser = S.left[0] || S.right[0] || null;
      S.step = 'end';
    }
    MCR.go('game:cascaron');
    if (S.step !== 'end') {
      MCR.ui.toast('🛟 ' + MCR.store.nameOf(winner) + ' se salva · ' + MCR.store.nameOf(loser) + ' va al final de la fila ' + (winnerSide === 'left' ? 'derecha' : 'izquierda') +
        (moved ? ' · ' + MCR.store.nameOf(moved) + ' pasa a encabezar la fila vacía' : ''));
    }
  }

  function viewDuel() {
    if (S.left.length + S.right.length <= 1) {
      S.loser = S.left[0] || S.right[0] || null;
      S.step = 'end';
      MCR.go('game:cascaron');
      return h('div', {});
    }

    const a = S.left[0];
    const b = S.right[0];

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Duelo ' + (S.round + 1)),
        h('div', { class: 'stage-word' }, '¡Piratas!'),
        h('div', { class: 'row', style: { gap: 'clamp(20px,6vw,70px)', alignItems: 'center' } },
          h('div', { class: 'center' },
            h('div', { class: 'tiny' }, 'Fila izquierda'),
            h('div', { class: 'duel-name a' }, MCR.store.nameOf(a))
          ),
          h('div', { class: 'score-vs' }, 'VS'),
          h('div', { class: 'center' },
            h('div', { class: 'tiny' }, 'Fila derecha'),
            h('div', { class: 'duel-name b' }, MCR.store.nameOf(b))
          )
        )
      ),
      h('div', { class: 'duel-actions' },
        h('button', { class: 'btn btn-blue btn-xl', onclick: () => resolve('left') }, 'Gana ' + MCR.store.nameOf(a)),
        h('button', { class: 'btn btn-red btn-xl', onclick: () => resolve('right') }, 'Gana ' + MCR.store.nameOf(b))
      ),
      h('div', { class: 'teams-board' },
        queueColumn('left', S.left, { compact: true }),
        queueColumn('right', S.right, { compact: true })
      ),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('span', { class: 'badge ok' }, 'A salvo: ' + S.saved.length),
        h('span', { class: 'badge warn' }, 'En riesgo: ' + (S.left.length + S.right.length))
      ),
      h('details', { class: 'panel hide-in-visual' },
        h('summary', null, '¿Llegó alguien? Súmalo a las filas'),
        h('div', { class: 'mt-s' }, MCR.ui.quickAdd(addQueuePlayer, { placeholder: 'Nombre de quien se suma…' }))
      )
    );
  }

  /* ---------- fin ---------- */

  function viewEnd() {
    const invictos = S.saved.filter((id) => !S.losses[id]);

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Gran perdedor'),
        h('div', { class: 'stage-word' }, MCR.store.nameOf(S.loser)),
        h('div', { class: 'stage-note' }, '¡Le toca el cascarón!')
      ),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'panel' },
          h('div', { class: 'panel-title' }, 'Invictos · ' + invictos.length),
          invictos.length
            ? h('div', { class: 'heat' }, invictos.map((id) => h('span', { class: 'badge ok' }, '🏆 ' + MCR.store.nameOf(id))))
            : h('p', { class: 'roster-note' }, 'Nadie terminó invicto esta vez.')
        ),
        h('div', { class: 'panel' },
          h('div', { class: 'panel-title' }, 'Últimos duelos · ' + S.round + ' en total'),
          h('div', { class: 'list' }, S.history.slice(-6).reverse().map((r) =>
            h('div', { class: 'trow' },
              h('div', { class: 'grow' },
                h('div', { class: 'trow-name' }, MCR.store.nameOf(r.winner) + ' venció a ' + MCR.store.nameOf(r.loser))
              ),
              h('span', { class: 'badge' }, '#' + r.round)
            )
          ))
        )
      ),
      MCR.ui.finishBar({
        route: 'game:cascaron',
        event: () => ({
          gameId: 'cascaron',
          // Quien se retiró antes de terminar no cuenta como participación completa.
          playerIds: MCR.ui.withSwapped(S, [].concat(S.saved, [S.loser], S.left, S.right)),
          winners: invictos.slice(),
          meta: { loser: S.loser, invictos, duelos: S.round, retired: (S.retired || []).slice() }
        }),
        again: () => {
          const active = S.active;
          reset();
          S.active = active;
          formTeams();
        },
        reset
      })
    );
  }

  MCR.screens['game:cascaron'] = render;
})();
