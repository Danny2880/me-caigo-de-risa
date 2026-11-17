window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 07 — Sin palabras
   Lectura de labios · parejas · tiempo · audífonos

   Flujo: participantes → número de parejas y tiempo → armar parejas → por pareja:
   jugar (reloj) → ¿entró la última palabra? → resultados.
   Roles por pareja: guesser = con audífonos, adivina · clue = dice con los labios.
   El mazo de palabras se baraja UNA vez por partida: ninguna pareja recibe una
   palabra que otra ya dijo delante de todos.
   ========================================================= */

(function () {
  const { h } = MCR.ui;

  let S = null;
  let rootEl = null;

  function reset() {
    S = {
      step: 'intro',
      pairCount: 2,
      pairs: [],
      current: 0,
      seconds: 60,
      deck: [],
      idx: 0,
      word: null,
      correct: 0,
      passed: 0,
      results: [],
      ctrl: null,
      timer: null,
      focusSlot: null,
      picks: null
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
      title: 'Sin palabras',
      sub: 'Lectura de labios · Juego 07',
      backTo: 'home',
      swap: { S, route: 'game:sinpalabras', gameId: 'sinpalabras', steps: ['play'], ids: () => (S.pairs || []).flatMap((p) => [p.guesser, p.clue]).filter(Boolean) }
    });
    root.append(g);

    const views = { intro: viewIntro, rules: viewRules, setup: viewSetup, participantes: viewParticipantes, pairs: viewPairs, play: viewPlay, lastword: viewLastword, end: viewEnd };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : ['setup', 'participantes', 'pairs'].includes(S.step) ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:sinpalabras', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 07',
      title: 'Sin palabras',
      summary: 'Con audífonos y música a todo volumen, adivina las palabras que tu pareja dice solo moviendo los labios.',
      details: ['Por parejas', 'Sin voz ni señas', 'Contra reloj'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:sinpalabras'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Sin palabras',
      goal: 'Adivinar el mayor número de palabras leyendo los labios de tu pareja.',
      steps: [
        'Se juega por parejas, una pareja a la vez. Una persona se pone audífonos con música alta (🎧 adivina) y la otra mira la tablet (🗣️ dice).',
        'Al iniciar el reloj aparece una palabra. Quien dice la articula solo con los labios: sin voz, sin sonidos y sin señas.',
        'Si la adivinan, toca «Correcta» y sale otra. Si se atoran, «Paso» la cambia sin sumar.',
        'Al terminar el tiempo se confirma si la última palabra alcanzó a entrar. Después juega la siguiente pareja.'
      ],
      win: 'Gana la pareja con más palabras correctas. Si empatan en primer lugar, comparten la victoria.',
      facts: [['Parejas', 'Una a la vez'], ['Tiempo', 'El mismo para todas'], ['Punto', '1 por palabra']],
      special: [
        'La persona con audífonos no debe ver la pantalla.',
        'Si marcaste «Correcta» por error, «Deshacer» la quita.',
        'Las palabras no se repiten entre parejas de la misma partida.',
        '«Registrar y cambiar roles» repite la partida con las mismas parejas y los papeles invertidos.'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:sinpalabras'); },
      onContinue: () => { S.step = 'participantes'; MCR.go('game:sinpalabras'); }
    });
  }

  /* ---------- setup ---------- */

  function viewSetup() {
    // Solo se ofrecen cantidades posibles con las personas marcadas (máximo 6 parejas).
    const maxPairs = Math.max(1, Math.min(6, Math.floor((S.picks || []).length / 2)));
    const counts = Array.from({ length: maxPairs }, (_, i) => i + 1);
    if (S.pairCount > maxPairs) S.pairCount = maxPairs;
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Preparación',
        title: '¿Cuántas parejas participan?',
        sub: 'Las parejas juegan una después de otra, con el mismo tiempo. Con ' + (S.picks || []).length + ' personas marcadas puedes formar hasta ' + maxPairs + '.'
      }),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Número de parejas'),
        h('div', { class: 'opt-grid' }, counts.map((n) =>
          h('button', {
            class: 'opt opt-big' + (S.pairCount === n ? ' sel' : ''),
            onclick: () => { S.pairCount = n; MCR.go('game:sinpalabras'); }
          }, String(n), h('small', null, n === 1 ? 'pareja' : 'parejas'))
        ))
      ),
      MCR.ui.durationPicker({
        title: 'Duración por pareja', value: S.seconds,
        onChange: (seconds) => {
          S.seconds = seconds;
          const info = rootEl.querySelector('.game-foot .action-bar-info');
          if (info && enoughForPairs()) info.textContent = S.pairCount + (S.pairCount === 1 ? ' pareja' : ' parejas') + ' · ' + MCR.ui.durationText(seconds) + ' por pareja';
        },
        onValidityChange: (valid) => { rootEl.querySelector('.game-foot .btn-gold').disabled = !valid || !enoughForPairs(); }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'participantes'; MCR.go('game:sinpalabras'); },
        info: enoughForPairs() ? S.pairCount + (S.pairCount === 1 ? ' pareja' : ' parejas') + ' · ' + MCR.ui.fmt(S.seconds) + ' por pareja' : 'Faltan ' + (S.pairCount * 2 - S.picks.length) + ' participantes para ' + S.pairCount + (S.pairCount === 1 ? ' pareja' : ' parejas'),
        ok: enoughForPairs(),
        disabled: !enoughForPairs(),
        next: () => {
          S.pairs = suggestPairs(S.pairCount);
          S.step = 'pairs';
          MCR.go('game:sinpalabras');
        },
        nextLabel: 'Formar parejas →'
      })
    );
  }

  function viewParticipantes() {
    if (!S.picks) S.picks = MCR.store.players().map((p) => p.id);
    const needed = S.pairCount * 2;
    const total = MCR.store.players().length;
    const enough = S.picks.length >= needed;
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Participantes',
        title: '¿Quiénes juegan?',
        sub: 'Vienen todas las personas presentes. Toca a quien vaya a descansar; las parejas se forman con el resto.'
      }),
      MCR.ui.peoplePicker({
        mode: 'roster',
        gameId: 'sinpalabras',
        ids: MCR.store.players().map((p) => p.id),
        selected: S.picks,
        min: 2,
        onChange: (ids) => { S.picks = ids; S.pairs = []; MCR.go('game:sinpalabras'); },
        onAdd: (p) => {
          if (!S.picks.includes(p.id)) S.picks.push(p.id);
          S.pairs = [];
          MCR.go('game:sinpalabras');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:sinpalabras'); },
        info: S.picks.length >= 2 ? S.picks.length + ' participantes' : 'Mínimo 2 participantes',
        ok: S.picks.length >= 2,
        disabled: S.picks.length < 2,
        next: () => { S.pairs = []; S.step = 'setup'; MCR.go('game:sinpalabras'); },
        nextLabel: 'Configurar parejas →'
      })
    );
  }

  function enoughForPairs() {
    return (S.picks || []).length >= S.pairCount * 2;
  }

  function suggestPairs(n) {
    const current = (S.pairs || []).flatMap((pair) => [pair.guesser, pair.clue]).filter(Boolean);
    const outside = MCR.store.players().map((p) => p.id).filter((id) => !S.picks.includes(id));
    const ids = MCR.store.recommendFresh(n * 2, current, { gameId: 'sinpalabras', exclude: outside });
    const pool = MCR.store.shuffle(ids);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        guesser: pool[i * 2] || null,
        clue: pool[i * 2 + 1] || null
      });
    }
    return out;
  }

  /* Cuántas veces jugó cada persona y en qué papel, solo en Sin palabras. */
  function gameStats() {
    const st = MCR.store.stats();
    const total = {};
    const guess = {};
    const clue = {};
    MCR.store.players().forEach((p) => {
      total[p.id] = ((st[p.id] || {}).byGame || {}).sinpalabras || 0;
      guess[p.id] = 0;
      clue[p.id] = 0;
    });
    MCR.store.eventsFor('sinpalabras').forEach((ev) => {
      ((ev.meta && ev.meta.roles) || []).forEach((r) => {
        if (r.guesser && guess[r.guesser] != null) guess[r.guesser] += 1;
        if (r.clue && clue[r.clue] != null) clue[r.clue] += 1;
      });
    });
    return { total, guess, clue };
  }

  /* ---------- parejas ---------- */

  function roleLabel(role) {
    return role === 'guesser' ? '🎧 Con audífonos · adivina' : '🗣️ Dice las palabras';
  }

  function findSlotOf(id) {
    for (let i = 0; i < S.pairs.length; i++) {
      if (S.pairs[i].guesser === id) return { i, role: 'guesser' };
      if (S.pairs[i].clue === id) return { i, role: 'clue' };
    }
    return null;
  }

  function firstEmptySlot() {
    for (let i = 0; i < S.pairs.length; i++) {
      if (!S.pairs[i].guesser) return { i, role: 'guesser' };
      if (!S.pairs[i].clue) return { i, role: 'clue' };
    }
    return null;
  }

  function currentSlot() {
    const first = firstEmptySlot();
    if (!first) return null;
    if (S.focusSlot) {
      const pair = S.pairs[S.focusSlot.i];
      if (pair && !pair[S.focusSlot.role]) return S.focusSlot;
    }
    return first;
  }

  function clearSlot(i, role) {
    S.pairs[i][role] = null;
    S.focusSlot = { i, role };
    MCR.go('game:sinpalabras');
  }

  function assignPlayer(id) {
    const slot = currentSlot();
    if (!slot) {
      MCR.ui.toast('Las parejas están completas. Quita a alguien para cambiar.');
      return;
    }
    const previous = findSlotOf(id);
    if (previous) S.pairs[previous.i][previous.role] = null;
    S.pairs[slot.i][slot.role] = id;
    S.focusSlot = null;
    MCR.go('game:sinpalabras');
  }

  function togglePlayer(id) {
    const slot = findSlotOf(id);
    if (slot) clearSlot(slot.i, slot.role);
    else assignPlayer(id);
  }

  function slotEl(pair, i, role, active, info) {
    const id = pair[role];
    const isActive = active && active.i === i && active.role === role;

    if (!id) {
      return h('button', {
        class: 'pair-slot empty role-' + role + (isActive ? ' active' : ''),
        'data-focus-key': 'slot-' + i + '-' + role,
        onclick: () => { S.focusSlot = { i, role }; MCR.go('game:sinpalabras'); }
      },
        h('div', { class: 'pair-slot-label' }, roleLabel(role)),
        h('div', { class: 'pair-slot-empty-main' },
          h('span', { class: 'pair-slot-plus' }, '+'),
          h('span', { class: 'pair-slot-empty-txt' },
            isActive ? 'Toca una persona de la lista' : 'Elegir persona')
        )
      );
    }

    const name = MCR.store.nameOf(id);
    const times = role === 'guesser' ? (info.guess[id] || 0) : (info.clue[id] || 0);
    return h('div', { class: 'pair-slot filled role-' + role },
      h('div', { class: 'pair-slot-label' }, roleLabel(role)),
      h('div', { class: 'pair-slot-main' },
        h('span', { class: 'pair-slot-avatar' }, MCR.ui.initials(name)),
        h('span', { class: 'pair-slot-txt' },
          h('span', { class: 'pair-slot-name' }, name),
          h('span', { class: 'pair-slot-meta' },
            times ? times + (times === 1 ? ' vez en este rol' : ' veces en este rol') : 'Primera vez en este rol')
        )
      ),
      h('button', {
        class: 'pair-slot-clear',
        title: 'Quitar a ' + name,
        'aria-label': 'Quitar a ' + name + ' de la pareja',
        'data-focus-key': 'clear-' + i + '-' + role,
        onclick: () => clearSlot(i, role)
      }, '×')
    );
  }

  function pairCard(pair, i, active, info) {
    const filled = (pair.guesser ? 1 : 0) + (pair.clue ? 1 : 0);
    const duplicate = pair.guesser && pair.clue && pair.guesser === pair.clue;
    const complete = pair.guesser && pair.clue && !duplicate;
    return h('section', { class: 'pair-card' + (complete ? ' complete' : '') },
      h('div', { class: 'pair-card-head' },
        h('div', { class: 'pair-card-title' },
          h('span', { class: 'pair-card-num' }, String(i + 1)),
          h('span', null, 'Pareja ' + (i + 1))
        ),
        h('span', { class: 'badge' + (complete ? ' ok' : ' gold') },
          duplicate ? 'Repite persona' : complete ? 'Completa' : filled ? 'Falta 1' : 'Falta 2')
      ),
      h('div', { class: 'pair-slots' },
        slotEl(pair, i, 'guesser', active, info),
        slotEl(pair, i, 'clue', active, info)
      )
    );
  }

  function viewPairs() {
    if (!S.pairs.length) S.pairs = suggestPairs(S.pairCount);
    const info = gameStats();
    const players = MCR.store.players().filter((p) => S.picks.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    const active = currentSlot();
    const free = players.filter((p) => !findSlotOf(p.id));
    const complete = S.pairs.filter((p) => p.guesser && p.clue && p.guesser !== p.clue).length;
    const filledSlots = S.pairs.reduce((sum, pair) => sum + (pair.guesser ? 1 : 0) + (pair.clue ? 1 : 0), 0);
    const remainingSlots = S.pairs.length * 2 - filledSlots;
    const canStart = S.pairs.every((p) => p.guesser && p.clue && p.guesser !== p.clue);

    const side = h('aside', { class: 'pair-side' },
      MCR.ui.peoplePicker({
        count: free.length + (free.length === 1 ? ' libre' : ' libres'),
        hint: active
          ? 'Toca a una persona para llenar ' + (active.role === 'guesser' ? '🎧 adivina' : '🗣️ dice') + ' de la pareja ' + (active.i + 1) + '.'
          : 'Parejas completas. Toca a alguien marcado para sacarlo de su pareja.',
        mode: 'pick',
        key: 'sinpalabras-parejas',
        title: 'Jugadores',
        gameId: 'sinpalabras',
        ids: players.map((p) => p.id),
        selected: players.map((p) => p.id).filter((id) => findSlotOf(id)),
        tray: false,
        bulk: false,
        showAbsent: false,
        order: 'az',
        tools: [
          h('button', {
            class: 'btn btn-quiet mini',
            'data-focus-key': 'pairs-suggest',
            onclick: () => { S.pairs = suggestPairs(S.pairCount); S.focusSlot = null; MCR.go('game:sinpalabras'); }
          }, '✨ Otras parejas'),
          filledSlots ? h('button', {
            class: 'btn btn-quiet mini',
            'data-focus-key': 'pairs-clear',
            onclick: () => { S.pairs = S.pairs.map(() => ({ guesser: null, clue: null })); S.focusSlot = null; MCR.go('game:sinpalabras'); }
          }, 'Vaciar') : null
        ],
        metaFor: (id) => {
          const slot = findSlotOf(id);
          if (slot) return 'Pareja ' + (slot.i + 1) + ' · ' + (slot.role === 'guesser' ? '🎧 adivina' : '🗣️ dice');
          const total = info.total[id] || 0;
          return total ? total + (total === 1 ? ' vez aquí' : ' veces aquí') : 'Nuevo aquí';
        },
        tagFor: () => null,
        onToggle: (id) => togglePlayer(id),
        onAdd: (p) => {
          if (!S.picks.includes(p.id)) S.picks.push(p.id);
          if (currentSlot()) assignPlayer(p.id);
          else MCR.go('game:sinpalabras');
        }
      }),
      h('div', { class: 'panel' },
        h('div', { class: 'row spread roster-head' },
          h('div', { class: 'panel-title' }, 'Progreso'),
          h('span', { class: 'badge' + (canStart ? ' ok' : '') }, complete + ' / ' + S.pairs.length)
        ),
        h('div', { class: 'pair-progress-track' },
          h('i', { style: { width: (S.pairs.length ? (complete / S.pairs.length) * 100 : 0) + '%' } })
        ),
        h('p', { class: 'roster-note', style: { margin: '10px 0 0' } },
          canStart
            ? 'Todo listo. Puedes empezar cuando quieras.'
            : 'Faltan ' + remainingSlots + (remainingSlots === 1 ? ' persona' : ' personas') + ' por asignar.')
      )
    );

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Parejas',
        title: 'Arma las parejas',
        sub: 'Cada pareja tiene dos roles: quien escucha con audífonos y adivina, y quien dice la palabra solo con los labios.'
      }),
      h('div', { class: 'pair-layout' },
        side,
        h('div', { class: 'pair-list' }, S.pairs.map((p, i) => pairCard(p, i, active, info)))
      ),
      MCR.ui.stepBar({
        back: () => { S.step = 'setup'; MCR.go('game:sinpalabras'); },
        info: canStart ? 'Parejas completas' : 'Faltan ' + remainingSlots + (remainingSlots === 1 ? ' lugar' : ' lugares'),
        ok: canStart,
        disabled: !canStart,
        next: () => {
          S.current = 0;
          S.results = [];
          buildDeck();
          startPair();
        },
        nextLabel: canStart ? 'Empezar con la pareja 1 →' : 'Completa las parejas'
      })
    );
  }

  /* ---------- jugar ---------- */

  function buildDeck() {
    S.deck = MCR.store.shuffle(MCR.store.get().content.lipWords);
    S.idx = 0;
  }

  function nextWord() {
    // Solo se rebaraja si se agotan TODAS las palabras de la lista.
    if (!S.deck.length || S.idx >= S.deck.length) buildDeck();
    S.word = S.deck[S.idx++];
  }

  function startPair() {
    S.correct = 0;
    S.passed = 0;
    S.log = [];
    S.timer = MCR.ui.newTimer(S.seconds);
    nextWord();
    S.step = 'play';
    MCR.go('game:sinpalabras');
  }

  function viewPlay() {
    const pair = S.pairs[S.current];
    if (!S.timer) S.timer = MCR.ui.newTimer(S.seconds);
    const t = S.timer;
    const live = t.status === 'running';
    const timer = MCR.ui.timerView(S, t, {
      route: 'game:sinpalabras',
      onEnd: () => { S.step = 'lastword'; MCR.go('game:sinpalabras'); }
    });

    const correct = () => { S.correct += 1; S.log = (S.log || []).concat(S.word); nextWord(); MCR.go('game:sinpalabras'); };
    const pass = () => { S.passed += 1; nextWord(); MCR.go('game:sinpalabras'); };
    const undo = () => {
      if (!S.log || !S.log.length) return;
      const word = S.log[S.log.length - 1];
      S.log = S.log.slice(0, -1);
      S.correct = Math.max(0, S.correct - 1);
      MCR.go('game:sinpalabras');
      MCR.ui.toast('Se quitó «' + word + '»');
    };

    timer.ring.classList.add('compact');
    return h('div', { class: 'grid stage-screen play-layout' },
      h('div', { class: 'stage hero-stage' },
        h('div', { class: 'stage-top' },
          h('div', { class: 'stage-top-info' },
            h('div', { class: 'stage-label' }, 'Pareja ' + (S.current + 1) + ' de ' + S.pairs.length),
            h('div', { class: 'stage-who' }, '🗣️ ' + MCR.store.nameOf(pair.clue) + ' dice · 🎧 ' + MCR.store.nameOf(pair.guesser) + ' adivina')
          ),
          timer.ring
        ),
        h('div', { class: 'stage-word hero' + (t.status === 'idle' ? ' veiled' : '') + (String(S.word || '').length > 9 ? ' long' : '') }, t.status === 'idle' ? '• • •' : S.word),
        h('div', { class: 'stage-note' }, t.status === 'idle'
          ? 'La palabra aparece al iniciar el reloj. Solo ' + MCR.store.nameOf(pair.clue) + ' debe ver la pantalla.'
          : 'Dila solo con los labios, sin voz.')
      ),
      h('div', { class: 'play-count', 'aria-live': 'polite' },
        h('span', null, '✓ ', h('strong', null, String(S.correct)), S.correct === 1 ? ' correcta' : ' correctas'),
        h('span', null, '⏭ ', h('strong', null, String(S.passed)), S.passed === 1 ? ' pasada' : ' pasadas')
      ),
      h('div', { class: 'duel-actions' },
        h('button', { class: 'btn btn-ghost btn-xl', disabled: !live, onclick: pass }, '⏭ Paso'),
        h('button', { class: 'btn btn-ok btn-xl', disabled: !live, onclick: correct }, '✓ Correcta')
      ),
      S.log && S.log.length ? h('div', { class: 'play-tools' },
        h('button', { class: 'btn btn-ghost mini', onclick: undo }, '↶ Deshacer última correcta')
      ) : null,
      h('div', { class: 'action-bar' }, timer.controls)
    );
  }

  /* ---------- última palabra ---------- */

  function viewLastword() {
    const pair = S.pairs[S.current];
    const close = (entered) => {
      if (entered) S.correct += 1;
      S.results.push({ pair, correct: S.correct, passed: S.passed });
      S.current += 1;
      S.timer = null;
      if (S.current >= S.pairs.length) {
        S.step = 'end';
        MCR.go('game:sinpalabras');
      } else {
        startPair();
      }
    };

    return h('div', { class: 'grid' },
      h('div', { class: 'panel center' },
        h('div', { class: 'eyebrow' }, '¡Tiempo! · ' + MCR.store.nameOf(pair.guesser) + ' + ' + MCR.store.nameOf(pair.clue)),
        h('h2', { class: 'section-title' }, '¿La última palabra alcanzó a entrar?'),
        h('div', { class: 'stage-word sm', style: { margin: '18px 0' } }, S.word),
        h('p', { class: 'roster-note' },
          'Llevan ' + S.correct + '. Si la adivinaron justo cuando sonó el tiempo, cuenta.')
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-danger btn-xl', onclick: () => close(false) }, '✕ No entró'),
        h('button', { class: 'btn btn-ok btn-xl', onclick: () => close(true) }, '✓ Sí entró')
      )
    );
  }

  /* ---------- fin ---------- */

  function viewEnd() {
    const sorted = S.results.slice().sort((a, b) => b.correct - a.correct || a.passed - b.passed);
    const best = sorted[0];
    const bestPairs = S.results.filter((r) => r.correct === best.correct);
    const tie = bestPairs.length > 1;
    const pairName = (r) => MCR.store.nameOf(r.pair.guesser) + ' + ' + MCR.store.nameOf(r.pair.clue);

    const winners = [];
    bestPairs.forEach((r) => {
      if (r.pair.guesser) winners.push(r.pair.guesser);
      if (r.pair.clue) winners.push(r.pair.clue);
    });

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, tie ? 'Empate en el primer lugar' : 'Mejor pareja'),
        h('div', { class: 'stage-word sm' }, tie ? bestPairs.map(pairName).join(' · ') : pairName(best)),
        h('div', { class: 'stage-note' }, best.correct + (best.correct === 1 ? ' palabra adivinada' : ' palabras adivinadas'))
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Resultados'),
        h('div', { class: 'list' }, sorted.map((r, i) =>
          h('div', { class: 'trow' },
            h('div', { class: 'card-num' }, String(i + 1)),
            h('div', { class: 'grow' },
              h('div', { class: 'trow-name' }, '🎧 ' + MCR.store.nameOf(r.pair.guesser) + ' · 🗣️ ' + MCR.store.nameOf(r.pair.clue)),
              h('div', { class: 'trow-meta' }, r.correct + ' correctas · ' + r.passed + ' pasadas')
            ),
            h('span', { class: 'badge gold' }, String(r.correct))
          )
        ))
      ),
      MCR.ui.finishBar({
        route: 'game:sinpalabras',
        event: () => ({
          gameId: 'sinpalabras',
          playerIds: MCR.ui.withSwapped(S, S.pairs.flatMap((p) => [p.guesser, p.clue])),
          winners: Array.from(new Set(winners)),
          meta: {
            results: S.results.map((r) => ({ correct: r.correct, passed: r.passed })),
            roles: S.pairs.map((p) => ({ guesser: p.guesser, clue: p.clue }))
          }
        }),
        // Mismas parejas con los papeles invertidos: quien adivinó ahora dice.
        again: () => {
          S.pairs = S.pairs.map((p) => ({ guesser: p.clue, clue: p.guesser }));
          S.results = [];
          S.current = 0;
          S.timer = null;
          S.step = 'pairs';
        },
        againLabel: 'Registrar y cambiar roles',
        reset
      })
    );
  }

  MCR.screens['game:sinpalabras'] = render;
})();
