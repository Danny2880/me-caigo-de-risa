window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 03 — Almohadazo
   Duelo 1 vs 1 · sílabas · pizarrón · tiempo · muerte súbita

   Cada duelista juega un turno propio (S.current = 0 y luego 1) con su propia
   consigna en S.configs[i] = { pos: 'ini' | 'fin', syl }. En cada turno se elige
   libremente «Empiezan» o «Terminan»; solo se impide repetir exactamente la misma
   consigna del primer turno. El tiempo (S.seconds) se fija en el primer turno y es
   idéntico para ambos: el segundo no lo puede cambiar.
   Empate → muerte súbita en 4 pasos (S.sud): consigna → juego hablado por turnos →
   quién falló (marcar + confirmar) → ganador (revisar + registrar).
   Cada duelo se registra al terminar; «Siguiente duelo» empieza otro con dos
   personas nuevas, conservando la lista de duelos de la sesión (S.history).
   ========================================================= */

(function () {
  const { h } = MCR.ui;

  let S = null;
  let rootEl = null;

  function reset() {
    S = {
      step: 'intro',
      picks: [],
      pair: [],
      pos: 'ini',
      syl: null,
      configs: [null, null],
      seconds: 60,
      counts: [0, 0],
      current: 0,
      winner: null,
      loser: null,
      round: 1,
      sudden: false,
      history: [],
      timer: null,
      ctrl: null
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
      title: 'Almohadazo',
      sub: 'Sílabas · Juego 03',
      backTo: 'home',
      swap: { S, route: 'game:almohadazo', gameId: 'almohadazo', steps: ['syllable', 'play'], ids: () => S.pair || [] }
    });
    root.append(g);

    const views = {
      intro: viewIntro,
      rules: viewRules,
      setup: viewSetup,
      syllable: viewSyllable,
      play: viewPlay,
      register: viewRegister,
      result: viewResult,
      sudden: viewSudden,
      end: viewEnd
    };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : S.step === 'setup' || S.step === 'syllable' ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:almohadazo', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 03',
      title: 'Almohadazo',
      summary: 'Duelo en el pizarrón: con el reloj corriendo, escribe todas las palabras que puedas que empiecen o terminen con una sílaba.',
      details: ['1 contra 1', 'Mismo tiempo para ambos', 'Empate: muerte súbita'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:almohadazo'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Almohadazo',
      script: '¡Uno contra uno, plumón en mano! Les doy una sílaba y escriben en el pizarrón todas las palabras que empiecen —o terminen— con ella antes de que se acabe el tiempo. Mismo reloj para los dos. Gana quien llene más el pizarrón.',
      goal: 'Escribir en el pizarrón más palabras válidas que tu rival.',
      steps: [
        'Se enfrentan dos personas. Cada una juega su propio turno, con una consigna distinta.',
        'Antes de cada turno se elige si las palabras deben empezar o terminar con una sílaba, y cuál. Cada turno puede elegir cualquiera de los dos modos; solo no se repite la misma consigna.',
        'Al iniciar el reloj, la persona escribe en el pizarrón todas las palabras que pueda. Las dos tienen exactamente el mismo tiempo.',
        'Al terminar cada turno, cuenten en voz alta las palabras válidas y regístrenlas.'
      ],
      win: 'Gana quien tenga más palabras válidas. Si empatan, muerte súbita: se elige una consigna nueva, dicen palabras en voz alta por turnos y pierde quien se equivoque, repita o se quede sin respuesta.',
      facts: [['Duelo', '1 contra 1'], ['Tiempo', 'El mismo para ambos'], ['Empate', 'Muerte súbita']],
      special: [
        'No cuenta una palabra repetida, mal escrita o que no cumpla la sílaba.',
        '«Pausar» detiene el reloj si algo interrumpe; «Reiniciar reloj» repite el turno completo.',
        'Si alguien ya no tiene más palabras, toca «Terminar turno».',
        'Cada duelo se registra al terminar; después pueden jugar otro con dos personas nuevas.'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:almohadazo'); },
      onContinue: () => { S.step = 'setup'; MCR.go('game:almohadazo'); }
    });
  }

  /* ---------- setup ---------- */


  function viewSetup() {
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: S.round > 1 ? 'Duelo ' + S.round : 'Paso 2',
        title: 'Elige a los dos del duelo',
        sub: '«Le toca» marca a quienes menos han jugado; puedes elegir a cualquiera. Cada duelo se registra por separado.'
      }),
      MCR.ui.peoplePicker({
        mode: 'pick',
        title: 'Duelistas',
        gameId: 'almohadazo',
        selected: S.picks,
        min: 2,
        max: 2,
        onChange: (ids) => { S.picks = ids; MCR.go('game:almohadazo'); },
        onAdd: (p) => {
          if (S.picks.length < 2 && !S.picks.includes(p.id)) S.picks.push(p.id);
          MCR.go('game:almohadazo');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:almohadazo'); },
        info: S.picks.length === 2 ? 'Duelo listo' : 'Elige exactamente 2',
        ok: S.picks.length === 2,
        disabled: S.picks.length !== 2,
        next: () => {
          S.pair = S.picks.slice();
          S.step = 'syllable';
          MCR.go('game:almohadazo');
        },
        nextLabel: 'Elegir sílaba →'
      })
    );
  }

  /* ---------- sílaba + tiempo ---------- */

  /* Solo se bloquea repetir exactamente la consigna del primer turno. */
  function sameAsFirst() {
    return S.current === 1 && !!S.configs[0] && !!S.syl && S.configs[0].pos === S.pos && S.configs[0].syl.s === S.syl.s;
  }

  function viewSyllable() {
    const content = MCR.store.get().content;
    const list = S.pos === 'ini' ? content.syllablesIni : content.syllablesFin;

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Turno ' + (S.current + 1) + ' de 2 · ' + MCR.store.nameOf(S.pair[S.current]),
        title: 'Consigna para ' + MCR.store.nameOf(S.pair[S.current]),
        sub: S.current === 0 ? 'Elige si las palabras deben empezar o terminar con la sílaba, cuál, y el tiempo del duelo.' : 'Elige libremente «Empiezan» o «Terminan» y la sílaba. Solo no puede ser exactamente la misma consigna del primer turno.'
      }),
      h('div', { class: 'panel' },
        S.current === 1 ? h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '0 0 12px' } },
          MCR.store.nameOf(S.pair[0]) + ' jugó «' + configText(S.configs[0]) + '». Puedes usar cualquiera de los dos modos.') : null,
        h('div', { class: 'row spread' },
          h('h2', { style: { fontSize: '24px' } }, '¿Empiezan o terminan con la sílaba?'),
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Posición de la sílaba' },
            h('button', { class: 'btn' + (S.pos === 'ini' ? ' seg-on' : ''), 'aria-pressed': String(S.pos === 'ini'), onclick: () => { S.pos = 'ini'; S.syl = null; MCR.go('game:almohadazo'); } }, 'Empiezan'),
            h('button', { class: 'btn' + (S.pos === 'fin' ? ' seg-on' : ''), 'aria-pressed': String(S.pos === 'fin'), onclick: () => { S.pos = 'fin'; S.syl = null; MCR.go('game:almohadazo'); } }, 'Terminan')
          )
        ),
        h('div', { class: 'tiny', style: { margin: '18px 0 10px' } }, S.pos === 'ini' ? 'Sílabas iniciales' : 'Terminaciones'),
        h('div', { class: 'syl-grid' }, list.map((x) =>
          h('button', {
            class: 'opt syl' + (S.syl && S.syl.s === x.s ? ' sel' : ''),
            disabled: S.current === 1 && S.configs[0].pos === S.pos && S.configs[0].syl.s === x.s,
            title: S.current === 1 && S.configs[0].pos === S.pos && S.configs[0].syl.s === x.s ? 'Ya la usó ' + MCR.store.nameOf(S.pair[0]) : null,
            onclick: () => { S.syl = x; MCR.go('game:almohadazo'); }
          }, x.s)
        ))
      ),
      S.current === 0 ? MCR.ui.durationPicker({
        title: 'Tiempo por turno (igual para ambos)', value: S.seconds, minSeconds: 10, maxSeconds: 300,
        onChange: (seconds) => { S.seconds = seconds; },
        onValidityChange: (valid) => {
          rootEl.querySelector('.game-foot .btn-gold').disabled = !valid || !S.syl;
        }
      }) : h('div', { class: 'panel locked-note' },
        h('span', { class: 'panel-title' }, 'Tiempo'),
        h('p', null, MCR.ui.durationText(S.seconds) + ', el mismo que tuvo ' + MCR.store.nameOf(S.pair[0]) + '. No se puede cambiar para que el duelo sea parejo.')
      ),
      MCR.ui.stepBar({
        back: () => {
          if (S.current === 0) S.step = 'setup';
          else {
            S.current = 0;
            S.pos = S.configs[0].pos;
            S.syl = S.configs[0].syl;
            S.step = 'register';
          }
          MCR.go('game:almohadazo');
        },
        backLabel: S.current === 0 ? '← Duelistas' : '← Recuento anterior',
        info: !S.syl ? 'Elige una sílaba' : sameAsFirst() ? 'Es la misma consigna del primer turno: elige otra' : 'Configuración lista',
        ok: !!S.syl && !sameAsFirst(),
        disabled: !S.syl || sameAsFirst(),
        next: () => {
          S.configs[S.current] = { pos: S.pos, syl: S.syl };
          if (S.current === 0) S.counts = [0, 0];
          S.timer = MCR.ui.newTimer(S.seconds);
          S.step = 'play';
          MCR.go('game:almohadazo');
        },
        nextLabel: S.syl ? 'Jugar con «' + S.syl.s + '» →' : 'Jugar →'
      })
    );
  }

  /* ---------- jugar ---------- */

  function viewPlay() {
    const id = S.pair[S.current];
    const config = S.configs[S.current];
    S.pos = config.pos;
    S.syl = config.syl;
    if (!S.timer) S.timer = MCR.ui.newTimer(S.seconds);
    const toRegister = () => {
      if (S.ctrl) { S.ctrl.stop(); S.ctrl = null; }
      S.step = 'register';
      MCR.go('game:almohadazo');
    };
    const timer = MCR.ui.timerView(S, S.timer, { route: 'game:almohadazo', onEnd: toRegister });
    const status = {
      idle: 'Cuando esté frente al pizarrón con el marcador, inicia el reloj.',
      running: '¡A escribir! Solo cuentan las palabras que cumplan la consigna.',
      paused: 'Reloj en pausa.',
      done: '¡Tiempo!'
    }[S.timer.status];

    timer.ring.classList.add('compact');
    return h('div', { class: 'grid stage-screen play-layout' },
      h('div', { class: 'stage hero-stage' },
        h('div', { class: 'stage-top' },
          h('div', { class: 'stage-top-info' },
            h('div', { class: 'stage-label' }, 'Turno ' + (S.current + 1) + ' de 2'),
            h('div', { class: 'stage-who' }, '✍️ Escribe ' + MCR.store.nameOf(id))
          ),
          timer.ring
        ),
        h('div', { class: 'stage-sub' }, S.pos === 'ini' ? 'Palabras que EMPIEZAN con' : 'Palabras que TERMINAN con'),
        h('div', { class: 'stage-word hero' }, (S.pos === 'ini' ? '' : '…') + S.syl.s + (S.pos === 'ini' ? '…' : '')),
        h('div', { class: 'stage-note' }, status)
      ),
      h('div', { class: 'action-bar' },
        timer.controls,
        S.timer.status !== 'idle' ? h('button', { class: 'btn btn-ghost', onclick: toRegister }, 'Terminar turno →') : null
      )
    );
  }

  /* ---------- registrar palabras ---------- */

  function viewRegister() {
    const id = S.pair[S.current];
    let n = S.counts[S.current] || 0;
    const num = h('div', { class: 'big-num' }, String(n));

    const paint = () => { num.textContent = String(n); };

    return h('div', { class: 'grid' },
      h('div', { class: 'panel center' },
        h('div', { class: 'eyebrow' }, 'Recuento · turno ' + (S.current + 1) + ' de 2'),
        h('h2', { style: { fontSize: 'clamp(20px,3vw,30px)' } }, '¿Cuántas palabras válidas escribió ' + MCR.store.nameOf(id) + '?'),
        h('div', { class: 'mt' }, num),
        h('div', { class: 'stepper mt' },
          h('button', { class: 'step-btn', 'aria-label': 'Restar una palabra', onclick: () => { n = Math.max(0, n - 1); paint(); } }, '−'),
          h('button', { class: 'step-btn', 'aria-label': 'Sumar una palabra', onclick: () => { n = n + 1; paint(); } }, '+')
        ),
        h('div', { class: 'row center', style: { justifyContent: 'center', marginTop: '16px' } },
          h('span', { class: 'badge' }, 'Sílaba: ' + S.syl.s),
          h('span', { class: 'badge' }, S.pos === 'ini' ? 'inicio' : 'final')
        )
      ),
      h('div', { class: 'action-bar' },
        h('button', {
          class: 'btn btn-gold btn-xl',
          onclick: () => {
            S.counts[S.current] = n;
            S.timer = null;
            if (S.current === 0) {
              S.current = 1;
              S.pos = S.configs[0].pos === 'ini' ? 'fin' : 'ini';
              S.syl = null;
              S.step = 'syllable';
            } else {
              S.step = 'result';
            }
            MCR.go('game:almohadazo');
          }
        }, S.current === 0 ? 'Siguiente jugador →' : 'Ver resultado →')
      )
    );
  }

  /* ---------- resultado ---------- */

  function viewResult() {
    const a = S.counts[0];
    const b = S.counts[1];
    const tie = a === b;
    const winnerIdx = a > b ? 0 : 1;

    if (tie) {
      return h('div', { class: 'grid' },
        h('div', { class: 'panel center' },
          h('div', { class: 'eyebrow' }, 'Empate'),
          h('h2', { style: { fontSize: 'clamp(26px,4vw,42px)' } }, a + ' — ' + b),
          h('p', { class: 'stage-note', style: { margin: '10px auto 0' } },
            'Muerte súbita: ahora contestan hablado, 1 × 1, sin escribir. Pierde el primero que se equivoque, repita o se quede sin palabras.')
        ),
        h('div', { class: 'action-bar' },
          h('button', { class: 'btn btn-gold btn-xl', onclick: () => {
            S.sudden = true;
            S.sud = { phase: 'setup', pos: 'ini', syl: null, turn: 0, loser: null };
            S.step = 'sudden';
            MCR.go('game:almohadazo');
          } }, '⚡ Ir a muerte súbita')
        )
      );
    }

    return h('div', { class: 'grid' },
      h('div', { class: 'score' },
        h('div', { class: 'score-side' + (winnerIdx === 0 ? ' win' : '') },
          h('div', { class: 'score-n' }, String(a)),
          h('div', { class: 'score-l' }, MCR.store.nameOf(S.pair[0])),
          h('div', { class: 'score-meta' }, configText(S.configs[0]))
        ),
        h('div', { class: 'score-vs' }, 'VS'),
        h('div', { class: 'score-side' + (winnerIdx === 1 ? ' win' : '') },
          h('div', { class: 'score-n' }, String(b)),
          h('div', { class: 'score-l' }, MCR.store.nameOf(S.pair[1])),
          h('div', { class: 'score-meta' }, configText(S.configs[1]))
        )
      ),
      h('div', { class: 'panel center' },
        h('div', { class: 'eyebrow' }, 'Ganador'),
        h('h2', { style: { fontSize: 'clamp(24px,3.6vw,36px)' } }, MCR.store.nameOf(S.pair[winnerIdx])),
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-gold btn-xl', onclick: () => closeRound(S.pair[winnerIdx]) }, 'Registrar duelo →')
      )
    );
  }

  /* ---------- muerte súbita ---------- */

  function viewSudden() {
    const go = () => MCR.go('game:almohadazo');
    if (!S.sud) S.sud = { phase: 'setup', pos: S.pos || 'ini', syl: S.syl || null, turn: 0, loser: null };
    const D = S.sud;
    const A = S.pair[0];
    const B = S.pair[1];
    const nm = MCR.store.nameOf;
    const phases = ['Consigna', 'Juego', '¿Quién falló?', 'Ganador'];
    const idx = { setup: 0, play: 1, lose: 2, confirm: 3 }[D.phase] || 0;
    const track = h('ol', { class: 'sud-track', 'aria-label': 'Pasos de la muerte súbita' }, phases.map((t, i) =>
      h('li', { class: (i < idx ? 'done' : '') + (i === idx ? ' now' : ''), 'aria-current': i === idx ? 'step' : null },
        h('span', { class: 'sud-n' }, i < idx ? '✓' : String(i + 1)), h('span', null, t))
    ));
    const consigna = () => (D.pos === 'ini' ? 'Palabras que empiezan con' : 'Palabras que terminan con') + ' «' + D.syl.s + '»';

    /* 1 · consigna nueva: modo libre y sílaba (sin repetir las del duelo). */
    if (D.phase === 'setup') {
      const content = MCR.store.get().content;
      const list = D.pos === 'ini' ? content.syllablesIni : content.syllablesFin;
      const usedHere = S.configs.filter((c) => c && c.pos === D.pos).map((c) => c.syl.s);
      const free = list.filter((x) => !usedHere.includes(x.s));
      return h('div', { class: 'grid' },
        track,
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, '⚡ Muerte súbita · empate ' + S.counts[0] + ' — ' + S.counts[1]),
          h('div', { class: 'row spread' },
            h('h2', { style: { fontSize: '24px' } }, 'Consigna para el desempate'),
            h('div', { class: 'segmented', role: 'group', 'aria-label': 'Posición de la sílaba' },
              h('button', { class: 'btn' + (D.pos === 'ini' ? ' seg-on' : ''), 'aria-pressed': String(D.pos === 'ini'), onclick: () => { D.pos = 'ini'; D.syl = null; go(); } }, 'Empiezan'),
              h('button', { class: 'btn' + (D.pos === 'fin' ? ' seg-on' : ''), 'aria-pressed': String(D.pos === 'fin'), onclick: () => { D.pos = 'fin'; D.syl = null; go(); } }, 'Terminan')
            )
          ),
          h('div', { class: 'row spread', style: { margin: '14px 0 10px' } },
            h('span', { class: 'tiny' }, D.pos === 'ini' ? 'Sílabas iniciales' : 'Terminaciones'),
            h('button', { class: 'btn btn-quiet mini', onclick: () => { D.syl = free[Math.floor(Math.random() * free.length)] || null; go(); } }, '🎲 Al azar')
          ),
          h('div', { class: 'syl-grid' }, list.map((x) =>
            h('button', {
              class: 'opt syl' + (D.syl && D.syl.s === x.s ? ' sel' : ''),
              disabled: usedHere.includes(x.s),
              title: usedHere.includes(x.s) ? 'Ya se usó en este duelo' : null,
              onclick: () => { D.syl = x; go(); }
            }, x.s)
          ))
        ),
        h('div', { class: 'action-bar' },
          h('div', { class: 'action-bar-info' }, D.syl ? consigna() : 'Elige la sílaba del desempate'),
          h('button', { class: 'btn btn-gold btn-xl', disabled: !D.syl, onclick: () => { D.phase = 'play'; D.turn = 0; go(); } }, '⚡ Empezar muerte súbita →')
        )
      );
    }

    /* 2 · juego hablado, por turnos, sin reloj. */
    if (D.phase === 'play') {
      const now = S.pair[D.turn];
      const next = S.pair[1 - D.turn];
      return h('div', { class: 'grid stage-screen' },
        h('div', { class: 'hide-in-visual' }, track),
        h('div', { class: 'stage' },
          h('div', { class: 'stage-label' }, 'Muerte súbita · hablado, 1 × 1, sin tiempo'),
          h('div', { class: 'stage-word' }, (D.pos === 'ini' ? '' : '…') + D.syl.s + (D.pos === 'ini' ? '…' : '')),
          h('div', { class: 'stage-note' }, consigna()),
          h('div', { class: 'sud-turn' },
            h('span', { class: 'sud-turn-l' }, 'Le toca a'),
            h('span', { class: 'sud-turn-name' }, nm(now))
          ),
          h('div', { class: 'stage-note' }, 'Pierde quien se equivoque, repita una palabra o se quede sin respuesta.')
        ),
        h('div', { class: 'action-bar' },
          h('button', { class: 'btn btn-ghost', onclick: () => { D.phase = 'setup'; go(); } }, '← Cambiar consigna'),
          h('button', { class: 'btn btn-ghost', onclick: () => { D.turn = 1 - D.turn; go(); } }, '✓ Dijo una buena · turno de ' + nm(next)),
          h('button', { class: 'btn btn-gold btn-xl', onclick: () => { D.loser = now; D.phase = 'lose'; go(); } }, '✕ Alguien falló →')
        )
      );
    }

    /* 3 · quién falló: marcar y confirmar (sugiere a quien tenía el turno). */
    if (D.phase === 'lose') {
      const sel = S.pair.includes(D.loser) ? D.loser : null;
      return h('div', { class: 'grid' },
        track,
        h('div', { class: 'panel center' },
          h('div', { class: 'eyebrow' }, 'Muerte súbita · ' + consigna()),
          h('h2', { style: { fontSize: 'clamp(22px,3.4vw,32px)', marginBottom: '6px' } }, '¿Quién falló?'),
          h('p', { class: 'stage-note', style: { margin: '0 auto 16px' } }, 'Ya está marcada la persona que tenía el turno. Si falló la otra, tócala.'),
          MCR.ui.choiceGrid({ ids: S.pair, value: sel, key: 'sud-lose', toggle: false, onSelect: (id) => { D.loser = id; go(); } })
        ),
        h('div', { class: 'action-bar' },
          h('button', { class: 'btn btn-ghost', onclick: () => { D.phase = 'play'; go(); } }, '← Seguir jugando'),
          MCR.ui.confirmBtn(sel, (n) => 'Confirmar · falló ' + n + ' →', () => { D.phase = 'confirm'; go(); })
        )
      );
    }

    /* 4 · ganador: revisar y registrar. */
    const loser = D.loser;
    const winner = S.pair.find((x) => x !== loser);
    return h('div', { class: 'grid' },
      track,
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, '🏆 Gana por muerte súbita'),
        h('div', { class: 'stage-word' }, nm(winner)),
        h('div', { class: 'stage-note' }, nm(loser) + ' falló con «' + D.syl.s + '» · pizarrón ' + S.counts[0] + ' — ' + S.counts[1])
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-ghost', onclick: () => { D.phase = 'lose'; go(); } }, '← Corregir'),
        h('button', { class: 'btn btn-gold btn-xl', onclick: () => {
          S.syl = D.syl; S.pos = D.pos;
          closeRound(winner);
        } }, 'Registrar duelo →')
      )
    );
  }

  /* ---------- cerrar duelo ---------- */

  function configText(config) {
    if (!config) return '';
    const syl = config.syl && config.syl.s != null ? config.syl.s : config.syl;
    return (config.pos === 'ini' ? 'empiezan con' : 'terminan con') + ' «' + syl + '»';
  }

  function closeRound(winnerId) {
    const loserId = S.pair.find((x) => x !== winnerId);
    MCR.ui.recordWithUndo({
      gameId: 'almohadazo',
      playerIds: MCR.ui.withSwapped(S, S.pair),
      winners: [winnerId],
      meta: {
        // configurations[i] corresponde a pair[i], igual que counts[i].
        pair: S.pair.slice(),
        configurations: S.configs.map((config) => ({ syllable: config.syl.s, position: config.pos })),
        counts: S.counts.slice(),
        sudden: S.sudden,
        suddenRule: S.sudden && S.sud && S.sud.syl ? { syllable: S.sud.syl.s, position: S.sud.pos } : null
      }
    }, 'Duelo registrado');
    // Antes se guardaba por ganador/perdedor y se cruzaban las sílabas: ahora se guarda por duelista.
    S.history.push({
      winner: winnerId,
      loser: loserId,
      pair: S.pair.slice(),
      configs: S.configs.map((config) => ({ syl: config.syl.s, pos: config.pos })),
      counts: S.counts.slice(),
      sudden: S.sudden
    });
    S.winner = winnerId;
    S.loser = loserId;
    S.step = 'end';
    MCR.go('game:almohadazo');
  }

  /* ---------- fin de duelo ---------- */

  function viewEnd() {
    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Ganador del duelo'),
        h('div', { class: 'stage-word' }, MCR.store.nameOf(S.winner)),
        h('div', { class: 'stage-note' }, S.sudden ? 'Por muerte súbita (' + S.counts[0] + ' — ' + S.counts[1] + ' en el pizarrón)' : S.counts[0] + ' — ' + S.counts[1])
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Duelos de esta sesión'),
        h('div', { class: 'list' }, S.history.map((r, i) =>
          h('div', { class: 'trow' },
            h('div', { class: 'card-num' }, String(i + 1)),
            h('div', { class: 'grow' },
              h('div', { class: 'trow-name' }, '🏆 ' + MCR.store.nameOf(r.winner) + (r.sudden ? ' · muerte súbita' : '')),
              h('div', { class: 'trow-meta' },
                (r.pair || [r.winner, r.loser]).map((pid, index) =>
                  MCR.store.nameOf(pid) + ' ' + r.counts[index] + ' (' + configText(r.configs[index]) + ')'
                ).join(' · '))
            )
          )
        ))
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-ghost', onclick: () => { MCR.ui.endGame('game:almohadazo'); reset(); MCR.go('catalog'); } }, 'Terminar · siguiente juego →'),
        h('button', {
          class: 'btn btn-gold btn-xl',
          onclick: () => {
            const hist = S.history;
            const seconds = S.seconds;
            reset();
            S.history = hist;
            S.seconds = seconds;
            S.round = hist.length + 1;
            S.step = 'setup';
            MCR.go('game:almohadazo');
          }
        }, '+ Siguiente duelo')
      )
    );
  }

  MCR.screens['game:almohadazo'] = render;
})();
