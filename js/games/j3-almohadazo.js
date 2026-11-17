window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 03 — Almohadazo
   Duelo 1 vs 1 · sílabas · pizarrón · tiempo · muerte súbita

   Cada duelista juega un turno propio (S.current = 0 y luego 1) con su propia
   consigna en S.configs[i] = { pos: 'ini' | 'fin', syl }. El segundo turno debe
   usar el modo contrario y otra sílaba. El tiempo (S.seconds) se fija en el primer
   turno y es idéntico para ambos: el segundo no lo puede cambiar.
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
      goal: 'Escribir en el pizarrón más palabras válidas que tu rival.',
      steps: [
        'Se enfrentan dos personas. Cada una juega su propio turno, con una consigna distinta.',
        'Antes de cada turno se elige si las palabras deben empezar o terminar con una sílaba, y cuál. El segundo turno usa el modo contrario y otra sílaba.',
        'Al iniciar el reloj, la persona escribe en el pizarrón todas las palabras que pueda. Las dos tienen exactamente el mismo tiempo.',
        'Al terminar cada turno, cuenten en voz alta las palabras válidas y regístrenlas.'
      ],
      win: 'Gana quien tenga más palabras válidas. Si empatan, muerte súbita: dicen palabras en voz alta por turnos y pierde quien se equivoque, repita o se quede sin respuesta.',
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

  function viewSyllable() {
    const content = MCR.store.get().content;
    const list = S.pos === 'ini' ? content.syllablesIni : content.syllablesFin;

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Turno ' + (S.current + 1) + ' de 2 · ' + MCR.store.nameOf(S.pair[S.current]),
        title: 'Consigna para ' + MCR.store.nameOf(S.pair[S.current]),
        sub: S.current === 0 ? 'Elige si las palabras deben empezar o terminar con la sílaba, cuál, y el tiempo del duelo.' : 'Este turno usa el modo contrario y otra sílaba.'
      }),
      h('div', { class: 'panel' },
        S.current === 1 ? h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '0 0 12px' } },
          'El primer duelista eligió ' + (S.configs[0].pos === 'ini' ? 'sílaba inicial' : 'sílaba final') + ' «' + S.configs[0].syl.s + '». Elige el modo contrario y otra sílaba.') : null,
        h('div', { class: 'row spread' },
          h('h2', { style: { fontSize: '24px' } }, '¿Empiezan o terminan con la sílaba?'),
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Posición de la sílaba' },
            h('button', { class: 'btn' + (S.pos === 'ini' ? ' seg-on' : ''), 'aria-pressed': String(S.pos === 'ini'), disabled: S.current === 1 && S.configs[0].pos === 'ini', onclick: () => { S.pos = 'ini'; S.syl = null; MCR.go('game:almohadazo'); } }, 'Empiezan'),
            h('button', { class: 'btn' + (S.pos === 'fin' ? ' seg-on' : ''), 'aria-pressed': String(S.pos === 'fin'), disabled: S.current === 1 && S.configs[0].pos === 'fin', onclick: () => { S.pos = 'fin'; S.syl = null; MCR.go('game:almohadazo'); } }, 'Terminan')
          )
        ),
        h('div', { class: 'tiny', style: { margin: '18px 0 10px' } }, S.pos === 'ini' ? 'Sílabas iniciales' : 'Terminaciones'),
        h('div', { class: 'syl-grid' }, list.map((x) =>
          h('button', {
            class: 'opt syl' + (S.syl && S.syl.s === x.s ? ' sel' : ''),
            disabled: S.current === 1 && S.configs[0].syl.s === x.s,
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
        info: !S.syl ? 'Elige una sílaba' : S.current === 1 && (S.configs[0].pos === S.pos || S.configs[0].syl.s === S.syl.s) ? 'Elige una configuración diferente' : 'Configuración lista',
        ok: !!S.syl && !(S.current === 1 && S.configs[0] && (S.configs[0].pos === S.pos || S.configs[0].syl.s === S.syl.s)),
        disabled: !S.syl || (S.current === 1 && S.configs[0] && (S.configs[0].pos === S.pos || S.configs[0].syl.s === S.syl.s)),
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

    return h('div', { class: 'grid stage-screen' },
      h('div', { class: 'stage' },
        h('div', { class: 'turn-badge' }, 'Turno ' + (S.current + 1) + ' de 2'),
        h('div', { class: 'stage-label' }, 'Escribe ' + MCR.store.nameOf(id)),
        h('div', { class: 'stage-word' }, (S.pos === 'ini' ? '' : '…') + S.syl.s + (S.pos === 'ini' ? '…' : '')),
        h('div', { class: 'stage-note' }, (S.pos === 'ini' ? 'Palabras que empiezan con' : 'Palabras que terminan con') + ' «' + S.syl.s + '»'),
        timer.ring,
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
          h('button', { class: 'btn btn-gold btn-xl', onclick: () => { S.sudden = true; S.step = 'sudden'; MCR.go('game:almohadazo'); } }, '⚡ Ir a muerte súbita')
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
    const content = MCR.store.get().content;
    const list = S.pos === 'ini' ? content.syllablesIni : content.syllablesFin;

    if (!S.syl) return h('div', {});
    const loseSel = S.pair.includes(S.sel) ? S.sel : null;

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Muerte súbita · sin tiempo'),
        h('div', { class: 'stage-word sm' }, '«' + S.syl.s + '»'),
        h('div', { class: 'stage-note' }, (S.pos === 'ini' ? 'Palabras que empiezan con' : 'Palabras que terminan con') + ' «' + S.syl.s + '». Hablado, 1 × 1.')
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Cambiar sílaba si quieres'),
        h('div', { class: 'opt-grid' }, list.slice(0, 12).map((x) =>
          h('button', {
            class: 'opt syl' + (S.syl.s === x.s ? ' sel' : ''),
            onclick: () => { S.syl = x; MCR.go('game:almohadazo'); }
          }, x.s)
        ))
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, '¿Quién perdió la muerte súbita?'),
        MCR.ui.choiceGrid({ ids: S.pair, value: loseSel, key: 'sudden', onSelect: (id) => { S.sel = id; MCR.go('game:almohadazo'); } })
      ),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, loseSel ? 'Gana ' + MCR.store.nameOf(S.pair.find((x) => x !== loseSel)) : 'Toca a quien perdió'),
        MCR.ui.confirmBtn(loseSel, (n) => 'Confirmar · perdió ' + n, (id) => {
          S.sel = null;
          closeRound(S.pair.find((x) => x !== id));
        })
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
      playerIds: S.pair.slice(),
      winners: [winnerId],
      meta: {
        // configurations[i] corresponde a pair[i], igual que counts[i].
        pair: S.pair.slice(),
        configurations: S.configs.map((config) => ({ syllable: config.syl.s, position: config.pos })),
        counts: S.counts.slice(),
        sudden: S.sudden
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
        h('button', { class: 'btn btn-ghost', onclick: () => { MCR.ui.endGame('game:almohadazo'); reset(); MCR.go('home'); } }, 'Terminar juego'),
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
