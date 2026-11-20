window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 05 — Te la compro
   Subasta de palabras · bluff · eliminación

   Mesa: S.order de izquierda a derecha; quien sale desaparece de la secuencia.
   Ronda:
     1. Quien abre (S.opener) hace la APUESTA INICIAL: no puede comprar porque aún
        no hay nada que comprar.
     2. El turno pasa a la derecha (y del último vuelve al primero que siga en
        juego). Cada quien SUBE la apuesta o dice «Te la compro» a quien hizo la
        última apuesta (S.bids[S.bids.length - 1]).
     3. Quien apostó intenta cumplir: lo logra → sale quien compró; no lo logra →
        sale quien apostó. Pantalla «salida» con el eliminado y quién abre después.
   La siguiente ronda la abre la persona a la derecha de quien abrió la anterior.
   ========================================================= */

(function () {
  const { h } = MCR.ui;

  let S = null;

  function reset() {
    S = {
      step: 'intro',
      picks: [],
      order: [],
      turn: 0,
      category: null,
      eliminated: [],
      buyer: null,
      challenged: null,
      opener: null,    // id de quien abre la ronda (apuesta inicial)
      turnId: null,    // id de quien tiene el turno
      bids: [],        // [{ id, n }] apuestas de la ronda, en orden
      draft: null,     // número que se está por apostar
      lastOut: null,   // { id, reason } para la pantalla de salida
      rounds: [],
      showUsedCats: false
    };
  }

  function render(root) {
    if (!S || root.dataset.newEntry === 'true') reset();
    root.dataset.view = S.step;
    const { root: g, body, foot } = MCR.ui.shell({
      title: 'Te la compro',
      sub: 'Subasta de palabras · Juego 05',
      backTo: 'home',
      swap: { S, route: 'game:telacompro', gameId: 'telacompro', steps: ['ronda', 'salida'], ids: () => (S.order || []).filter((id) => !S.eliminated.includes(id)) }
    });
    root.append(g);

    const views = { intro: viewIntro, rules: viewRules, setup: viewSetup, ronda: viewRonda, resolver: viewResolver, salida: viewSalida, fin: viewFin };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : S.step === 'setup' ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:telacompro', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 05',
      title: 'Te la compro',
      summary: 'Una subasta de palabras con faroles: ¿cuántas cosas de esta categoría puedes nombrar? Sube la apuesta… o di «Te la compro» y que lo demuestren.',
      details: ['3 a 6 jugadores', 'Una persona sale por ronda', 'Gana quien quede al final'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:telacompro'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Te la compro',
      script: 'Les doy una categoría y empieza la subasta: «Yo digo cuatro», «¡Yo cinco!». Sube la apuesta… o, si crees que alguien está echando mentiras, dile «¡Te la compro!». Si cumple, sales tú; si no cumple, sale quien apostó. Al final queda una sola persona.',
      origin: 'En el programa: «Te la compro», con el mismo nombre.',
      goal: 'Ser la última persona en la subasta: apuesta con valor, pero no prometas más de lo que puedes cumplir.',
      steps: [
        'Se anuncia una categoría. Quien abre la ronda hace la apuesta inicial: cuántas palabras de esa categoría puede decir («yo digo 4»).',
        'El turno pasa a la derecha, en el orden de la mesa; después del último vuelve al primero. Cada quien sube la apuesta o dice «Te la compro» a quien hizo la última apuesta.',
        'Quien hizo esa apuesta debe decir en voz alta esa cantidad de palabras válidas, sin repetir.',
        'Si lo logra, sale quien compró. Si no lo logra, sale quien apostó. Sigue otra ronda con quienes quedan, en el mismo orden.'
      ],
      win: 'Gana la última persona que queda en la subasta.',
      facts: [['Jugadores', '3 a 6 (ideal 5)'], ['Por ronda', 'Sale 1 persona'], ['Rondas', 'Hasta que queda 1']],
      special: [
        'La primera persona de cada ronda no puede comprar: todavía no hay apuesta.',
        'Cada ronda la abre la persona a la derecha de quien abrió la anterior.',
        '«↩ Deshacer apuesta» corrige un toque equivocado.',
        'Si alguien tiene que irse, márcalo como «Se retira» en la mesa: sale sin afectar a los demás.',
        'Las categorías usadas se bloquean; «Permitir repetir usadas» las vuelve a habilitar.'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:telacompro'); },
      onContinue: () => { S.step = 'setup'; MCR.go('game:telacompro'); }
    });
  }

  /* ---------- setup ---------- */


  function viewSetup() {
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Preparación',
        title: 'Elige a los jugadores de la subasta',
        sub: 'De 3 a 6 personas; lo ideal son 5. «Le toca» marca a quienes menos han jugado. Los lugares siguen el orden de la mesa.'
      }),
      MCR.ui.peoplePicker({
        mode: 'pick',
        title: 'En la subasta',
        gameId: 'telacompro',
        selected: S.picks,
        min: 3,
        max: 6,
        target: 5,
        onChange: (ids) => { S.picks = ids; MCR.go('game:telacompro'); },
        onAdd: (p) => {
          if (S.picks.length < 6 && !S.picks.includes(p.id)) S.picks.push(p.id);
          MCR.go('game:telacompro');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:telacompro'); },
        info: S.picks.length >= 3 ? S.picks.length + ' jugadores en subasta' : 'Mínimo 3 jugadores',
        ok: S.picks.length >= 3,
        disabled: S.picks.length < 3,
        next: () => {
          S.order = S.picks.slice();
          S.turn = 0;
          S.eliminated = [];
          S.opener = S.order[0];
          startRound();
          S.step = 'ronda';
          MCR.go('game:telacompro');
        },
        nextLabel: 'Comenzar subasta →'
      })
    );
  }

  /* ---------- ronda ---------- */

  function categoryPicker(onPick) {
    const cats = MCR.store.get().content.categories;
    const usedSet = new Set(MCR.store.used('categories'));
    const usedCount = cats.filter((c) => usedSet.has(c.id)).length;
    const ordered = cats.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }));
    const wrap = h('div', { class: 'opt-grid category-grid' }, ordered.map((c) => {
      const isUsed = usedSet.has(c.id);
      return h('button', {
        class: 'opt category-option' + (S.category && S.category.id === c.id ? ' sel' : '') + (isUsed ? ' used' : ''),
        disabled: isUsed && !S.showUsedCats,
        onclick: () => onPick(c)
      },
        h('span', { class: 'category-name' }, c.name),
        h('small', { class: 'category-status' }, isUsed ? 'Ya usada' : 'Disponible')
      );
    }));
    if (!cats.length) wrap.append(h('div', { class: 'empty' }, 'No hay categorías. Agrega algunas en Ajustes → Contenido.'));

    return h('div', { class: 'grid' },
      h('div', { class: 'row spread' },
        h('span', { class: 'tiny' }, usedCount + ' de ' + cats.length + ' categorías usadas'),
        h('button', {
          class: 'btn btn-quiet mini',
          onclick: () => { S.showUsedCats = !S.showUsedCats; MCR.go('game:telacompro'); }
        }, S.showUsedCats ? 'Bloquear usadas' : 'Permitir repetir usadas')
      ),
      wrap
    );
  }

  function alivePlayers() {
    return S.order.filter((id) => !S.eliminated.includes(id));
  }

  /* Siguiente persona en juego a la derecha de «id» (del último vuelve al primero).
     Funciona aunque «id» ya haya salido: se busca a partir de su lugar en la mesa. */
  function nextAlive(id) {
    const n = S.order.length;
    const start = S.order.indexOf(id);
    for (let k = 1; k <= n; k++) {
      const cand = S.order[(start + k) % n];
      if (!S.eliminated.includes(cand)) return cand;
    }
    return null;
  }

  function startRound() {
    if (S.eliminated.includes(S.opener)) S.opener = nextAlive(S.opener);
    S.bids = [];
    S.turnId = S.opener;
    S.draft = null;
    S.buyer = null;
    S.challenged = null;
  }

  const lastBid = () => S.bids[S.bids.length - 1] || null;
  const nm = (id) => MCR.store.nameOf(id);
  const words = (n) => n + (n === 1 ? ' palabra' : ' palabras');

  function retire(id) {
    const name = nm(id);
    S.eliminated.push(id);
    S.rounds.push({ category: S.category ? S.category.name : '—', out: id, retired: true });
    const alive = alivePlayers();
    if (alive.length <= 1) { S.step = 'fin'; MCR.go('game:telacompro'); MCR.ui.toast(name + ' se retiró de la subasta'); return; }
    S.bids = S.bids.filter((b) => b.id !== id);
    if (S.opener === id) S.opener = nextAlive(id);
    if (S.turnId === id) S.turnId = nextAlive(id);
    if (!S.bids.length) S.turnId = S.opener;
    if (S.step === 'resolver' && (S.buyer === id || S.challenged === id)) { S.step = 'ronda'; S.buyer = null; S.challenged = null; }
    S.draft = null;
    MCR.go('game:telacompro');
    MCR.ui.toast(name + ' se retiró de la subasta');
  }

  /* Mesa de izquierda a derecha: solo quienes siguen en juego. */
  function orderPanel(opts) {
    opts = opts || {};
    const alive = alivePlayers();
    const lb = lastBid();
    const out = S.order.filter((id) => S.eliminated.includes(id));
    return h('div', { class: 'panel hide-in-visual tlc-table' },
      h('div', { class: 'row spread' },
        h('div', { class: 'panel-title' }, 'Mesa · ' + alive.length + ' en juego · el turno va a la derecha →'),
        h('span', { class: 'tiny' }, '«se retira» si alguien se va')
      ),
      h('ol', { class: 'table-order' }, alive.map((id, i) => {
        const isTurn = id === opts.turn;
        const isBid = lb && lb.id === id;
        return h('li', { class: 'table-seat' + (isTurn ? ' active' : '') + (isBid ? ' bidder' : '') },
          h('span', { class: 'table-seat-n' }, String(i + 1)),
          h('span', { class: 'table-seat-name' }, nm(id)),
          isTurn ? h('span', { class: 'table-seat-tag' }, 'su turno') : null,
          isBid ? h('span', { class: 'table-seat-tag bid' }, 'apostó ' + lb.n) : null,
          !isTurn && !isBid && id === S.opener && !S.bids.length ? h('span', { class: 'table-seat-tag' }, 'abre') : null,
          opts.retire !== false ? h('button', { class: 'table-seat-out', 'aria-label': nm(id) + ' se retira', title: 'Se retira', onclick: () => retire(id) }, 'se retira') : null
        );
      })),
      out.length ? h('div', { class: 'tiny tlc-out' }, 'Fuera: ' + out.map(nm).join(', ')) : null
    );
  }

  function viewRonda() {
    const alive = alivePlayers();
    if (!S.opener || !alive.includes(S.opener)) S.opener = S.opener ? nextAlive(S.opener) : alive[0];
    if (!S.turnId || !alive.includes(S.turnId)) S.turnId = S.bids.length ? nextAlive(lastBid().id) : S.opener;
    const active = S.turnId;
    const roundNo = S.rounds.filter((r) => !r.retired).length + 1;

    if (!S.category) {
      return h('div', { class: 'grid' },
        h('div', { class: 'panel' },
          h('div', { class: 'row spread' },
            h('div', null,
              h('div', { class: 'eyebrow' }, 'Ronda ' + roundNo),
              h('h2', { class: 'section-title' }, 'Categoría de la subasta')
            ),
            h('span', { class: 'badge gold' }, 'Abre ' + nm(S.opener))
          ),
          h('div', { class: 'mt' }, categoryPicker((c) => {
            S.category = c;
            MCR.store.markUsed('categories', c.id);
            startRound();
            MCR.go('game:telacompro');
          }))
        ),
        orderPanel({ turn: S.opener })
      );
    }

    const lb = lastBid();
    const first = !lb;
    const min = lb ? lb.n + 1 : 1;
    if (S.draft == null || S.draft < min) S.draft = lb ? lb.n + 1 : 3;
    const draftNum = h('span', { class: 'tlc-bet-n' }, String(S.draft));
    const setDraft = (v) => { S.draft = Math.max(min, Math.min(99, v)); draftNum.textContent = String(S.draft); bidBtn.querySelector('.tlc-btn-main').textContent = (first ? 'Apuesta inicial: ' : 'Sube a ') + words(S.draft); minus.disabled = S.draft <= min; };
    const minus = h('button', { class: 'step-btn', 'aria-label': 'Una palabra menos', disabled: S.draft <= min, onclick: () => setDraft(S.draft - 1) }, '−');

    const bidBtn = h('button', {
      class: 'btn btn-gold tlc-btn',
      onclick: () => {
        S.bids.push({ id: active, n: S.draft });
        S.turnId = nextAlive(active);
        S.draft = null;
        MCR.go('game:telacompro');
      }
    },
      h('span', { class: 'tlc-btn-main' }, (first ? 'Apuesta inicial: ' : 'Sube a ') + words(S.draft)),
      h('span', { class: 'tlc-btn-sub' }, first ? nm(active) + ' abre la ronda' : nm(active) + ' sube la apuesta')
    );
    const buyBtn = h('button', {
      class: 'btn btn-ghost tlc-btn tlc-buy',
      disabled: first,
      title: first ? 'Todavía no hay apuesta que comprar' : null,
      onclick: () => {
        S.buyer = active;
        S.challenged = lb.id;
        S.step = 'resolver';
        MCR.go('game:telacompro');
      }
    },
      h('span', { class: 'tlc-btn-main' }, '🔨 Te la compro'),
      h('span', { class: 'tlc-btn-sub' }, first ? 'Aún no hay apuesta que comprar' : 'a ' + nm(lb.id) + ' · ' + words(lb.n))
    );

    return h('div', { class: 'grid' },
      h('div', { class: 'stage tlc-stage' },
        h('div', { class: 'stage-label' }, 'Ronda ' + roundNo + ' · categoría'),
        h('div', { class: 'stage-word mid' }, S.category.name),
        h('div', { class: 'tlc-turn' },
          h('span', { class: 'tlc-turn-l' }, 'Turno de'),
          h('span', { class: 'tlc-turn-name' }, nm(active))
        ),
        h('div', { class: 'tlc-current' + (lb ? '' : ' empty') },
          lb ? ['Apuesta actual: ', h('strong', null, words(lb.n)), ' · de ' + nm(lb.id)]
             : 'Sin apuesta todavía: ' + nm(active) + ' hace la apuesta inicial'
        ),
        h('div', { class: 'row center-row hide-in-visual' },
          S.bids.length ? h('button', { class: 'btn btn-quiet mini', onclick: () => { const b = S.bids.pop(); S.turnId = b.id; S.draft = b.n; MCR.go('game:telacompro'); } }, '↩ Deshacer apuesta') : null,
          !S.bids.length ? h('button', { class: 'btn btn-quiet mini', onclick: () => { S.category = null; MCR.go('game:telacompro'); } }, 'Cambiar categoría') : null
        )
      ),
      orderPanel({ turn: active }),
      h('div', { class: 'action-bar tlc-actions' },
        h('div', { class: 'tlc-bet', role: 'group', 'aria-label': 'Cantidad de palabras' },
          h('span', { class: 'tlc-bet-l' }, first ? 'Apuesta inicial' : 'Nueva apuesta'),
          minus,
          draftNum,
          h('button', { class: 'step-btn', 'aria-label': 'Una palabra más', onclick: () => setDraft(S.draft + 1) }, '+')
        ),
        buyBtn,
        bidBtn
      )
    );
  }

  /* ---------- resolver: ¿cumplió la apuesta? ---------- */

  function viewResolver() {
    const lb = lastBid();
    if (!S.buyer || !S.challenged || !lb) { S.step = 'ronda'; return viewRonda(); }
    const eliminate = (id, reason) => {
      S.eliminated.push(id);
      S.rounds.push({ category: S.category ? S.category.name : '—', buyer: S.buyer, challenged: S.challenged, bid: lb.n, out: id, reason });
      S.lastOut = { id, reason, buyer: S.buyer, challenged: S.challenged, bid: lb.n, category: S.category ? S.category.name : '' };
      S.category = null;
      S.opener = nextAlive(S.opener);
      startRound();
      S.step = alivePlayers().length <= 1 ? 'fin' : 'salida';
      MCR.go('game:telacompro');
    };

    return h('div', { class: 'grid' },
      h('div', { class: 'stage tlc-stage' },
        h('div', { class: 'stage-label' }, '🔨 ' + nm(S.buyer) + ' le compró a ' + nm(S.challenged)),
        h('div', { class: 'stage-word sm' }, words(lb.n)),
        h('div', { class: 'stage-note' }, nm(S.challenged) + ' debe decir ' + words(lb.n) + ' de «' + S.category.name + '», sin repetir.')
      ),
      h('div', { class: 'tlc-verdict' },
        h('button', { class: 'btn btn-ok tlc-btn', onclick: () => eliminate(S.buyer, 'cumplió') },
          h('span', { class: 'tlc-btn-main' }, '✓ Sí lo logró'),
          h('span', { class: 'tlc-btn-sub' }, 'Sale ' + nm(S.buyer) + ' (compró)')
        ),
        h('button', { class: 'btn btn-danger tlc-btn', onclick: () => eliminate(S.challenged, 'no cumplió') },
          h('span', { class: 'tlc-btn-main' }, '✕ No lo logró'),
          h('span', { class: 'tlc-btn-sub' }, 'Sale ' + nm(S.challenged) + ' (apostó)')
        )
      ),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-ghost', onclick: () => { S.buyer = null; S.challenged = null; S.step = 'ronda'; MCR.go('game:telacompro'); } }, '← No hubo compra, volver')
      )
    );
  }

  /* ---------- salida: quién queda eliminado ---------- */

  function viewSalida() {
    const o = S.lastOut || {};
    const alive = alivePlayers();
    return h('div', { class: 'grid' },
      h('div', { class: 'stage tlc-stage' },
        h('div', { class: 'stage-label' }, 'Queda eliminado'),
        h('div', { class: 'stage-word tlc-out-name' }, '✕ ' + nm(o.id)),
        h('div', { class: 'stage-note' }, o.reason === 'cumplió'
          ? nm(o.challenged) + ' sí dijo ' + words(o.bid) + ': sale quien compró.'
          : nm(o.challenged) + ' no logró ' + words(o.bid) + ': sale quien apostó.')
      ),
      orderPanel({ turn: S.opener, retire: false }),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, 'Quedan ' + alive.length + ' · abre ' + nm(S.opener)),
        h('button', { class: 'btn btn-gold btn-xl', onclick: () => { S.lastOut = null; S.step = 'ronda'; MCR.go('game:telacompro'); } }, 'Siguiente ronda →')
      )
    );
  }

  /* ---------- fin ---------- */

  function viewFin() {
    const alive = alivePlayers();
    const champion = alive[0];

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Ganador de la subasta'),
        h('div', { class: 'stage-word' }, MCR.store.nameOf(champion)),
        h('div', { class: 'stage-note' }, 'Aguantó todas las compras.')
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Orden de salida'),
        h('div', { class: 'list' }, S.rounds.map((r, i) =>
          h('div', { class: 'trow' },
            h('div', { class: 'card-num' }, String(i + 1)),
            h('div', { class: 'grow' },
              h('div', { class: 'trow-name' }, '✕ ' + MCR.store.nameOf(r.out)),
              h('div', { class: 'trow-meta' }, r.retired ? 'Se retiró' : r.category + ' · ' + MCR.store.nameOf(r.buyer) + ' le compró a ' + MCR.store.nameOf(r.challenged) + (r.bid ? ' (' + r.bid + ')' : '') + (r.reason ? ' · ' + r.reason : ''))
            )
          )
        ))
      ),
      MCR.ui.finishBar({
        route: 'game:telacompro',
        event: () => ({
          gameId: 'telacompro',
          /* Quien se retiró cuenta si alcanzó a jugar al menos una ronda. */
          playerIds: MCR.ui.withSwapped(S, S.order.filter((id) => {
            const k = S.rounds.findIndex((r) => r.retired && r.out === id);
            return k < 0 || S.rounds.slice(0, k).some((r) => !r.retired);
          })),
          winners: champion ? [champion] : [],
          meta: { rounds: S.rounds.filter((r) => !r.retired).length }
        }),
        again: () => { reset(); S.step = 'setup'; },
        reset
      })
    );
  }

  MCR.screens['game:telacompro'] = render;
})();
