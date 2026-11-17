window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 05 — Te la compro
   Subasta de palabras · bluff · eliminación

   Ronda: por turnos cada persona sube la apuesta («yo digo 5 palabras de esta
   categoría»). Cuando alguien no quiere subir, dice «Te la compro» a quien hizo
   la última apuesta: esa persona debe decir esa cantidad de palabras válidas.
     · Lo logra  → sale quien compró.
     · No lo logra → sale quien apostó.
   La app no registra números ni palabras: solo quién compró, a quién y quién sale.
   El turno lo lleva S.turn sobre la lista de personas vivas; cada ronda nueva la
   abre la siguiente persona (rota), para que no siempre empiece la misma.
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
      swap: { S, route: 'game:telacompro', gameId: 'telacompro', steps: ['ronda'], ids: () => (S.order || []).filter((id) => !S.eliminated.includes(id)) }
    });
    root.append(g);

    const views = { intro: viewIntro, rules: viewRules, setup: viewSetup, ronda: viewRonda, resolver: viewResolver, fin: viewFin };
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
      goal: 'Ser la última persona en la subasta: apuesta con valor, pero no prometas más de lo que puedes cumplir.',
      steps: [
        'Se anuncia una categoría. Por turnos, cada persona dice cuántas palabras de esa categoría puede nombrar («yo digo 4»). Cada apuesta debe ser mayor que la anterior.',
        'Cuando a alguien le toca y no quiere subir, dice «Te la compro» a quien hizo la última apuesta.',
        'Quien apostó debe decir en voz alta esa cantidad de palabras válidas, sin repetir.',
        'Si lo logra, sale quien compró. Si no lo logra, sale quien apostó. Empieza otra ronda con una categoría nueva.'
      ],
      win: 'Gana la última persona que queda en la subasta.',
      facts: [['Jugadores', '3 a 6 (ideal 5)'], ['Por ronda', 'Sale 1 persona'], ['Rondas', 'Hasta que queda 1']],
      special: [
        'La app sugiere como retado a quien apostó justo antes de quien compra; puedes cambiarlo.',
        'Cada ronda la abre una persona distinta.',
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
    const ordered = cats;
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

  /* Persona que hizo la apuesta inmediatamente anterior a «buyer» en la mesa. */
  function previousBidder(buyer) {
    const alive = alivePlayers();
    const i = alive.indexOf(buyer);
    if (i < 0 || alive.length < 2) return null;
    return alive[(i - 1 + alive.length) % alive.length];
  }

  function retire(id) {
    const name = MCR.store.nameOf(id);
    S.eliminated.push(id);
    S.rounds.push({ category: S.category ? S.category.name : '—', out: id, retired: true });
    const alive = alivePlayers();
    if (alive.length <= 1) S.step = 'fin';
    else S.turn = S.turn % alive.length;
    MCR.go('game:telacompro');
    MCR.ui.toast(name + ' se retiró de la subasta');
  }

  function orderPanel(alive, active, withActions) {
    return h('div', { class: 'panel hide-in-visual' },
      h('div', { class: 'row spread' },
        h('div', { class: 'panel-title' }, 'Mesa · ' + alive.length + ' en juego'),
        h('span', { class: 'tiny' }, 'Toca «se retira» si alguien se va')
      ),
      h('div', { class: 'table-order' }, alive.map((id) =>
        h('div', { class: 'table-seat' + (id === active ? ' active' : '') },
          h('span', { class: 'table-seat-name' }, MCR.store.nameOf(id)),
          id === active ? h('span', { class: 'table-seat-tag' }, 'su turno') : null,
          h('button', { class: 'table-seat-out', 'aria-label': MCR.store.nameOf(id) + ' se retira', title: 'Se retira', onclick: () => retire(id) }, 'se retira')
        )
      )),
    );
  }

  function viewRonda() {
    const alive = alivePlayers();
    const active = alive[S.turn % alive.length];

    if (!S.category) {
      return h('div', { class: 'grid' },
        h('div', { class: 'panel' },
          h('div', { class: 'row spread' },
            h('div', null,
              h('div', { class: 'eyebrow' }, 'Ronda ' + (S.rounds.filter((r) => !r.retired).length + 1)),
              h('h2', { class: 'section-title' }, 'Categoría de la subasta')
            ),
            h('span', { class: 'badge gold' }, 'Abre ' + MCR.store.nameOf(active))
          ),
          h('div', { class: 'mt' }, categoryPicker((c) => {
            S.category = c;
            MCR.store.markUsed('categories', c.id);
            MCR.go('game:telacompro');
          }))
        ),
        orderPanel(alive, active, false)
      );
    }

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Categoría'),
        h('div', { class: 'stage-word sm' }, S.category.name),
        h('div', { class: 'turn-badge' }, 'Turno de ' + MCR.store.nameOf(active)),
        h('div', { class: 'stage-note' }, 'Sube la apuesta… o di «Te la compro».'),
        h('button', { class: 'btn btn-quiet mini hide-in-visual', onclick: () => { S.category = null; MCR.go('game:telacompro'); } }, 'Cambiar categoría')
      ),
      orderPanel(alive, active, true),
      /* Las dos respuestas posibles del turno, juntas en el pie: subir (avanza el
         turno, secundaria) o comprar (cierra la ronda, principal). */
      h('div', { class: 'action-bar' },
        h('button', {
          class: 'btn btn-ghost',
          onclick: () => { S.turn = (S.turn + 1) % Math.max(1, alive.length); MCR.go('game:telacompro'); }
        }, 'Subió la apuesta · siguiente →'),
        h('button', {
          class: 'btn btn-gold btn-xl',
          onclick: () => {
            S.step = 'resolver';
            S.buyer = active;
            S.challenged = previousBidder(active);
            MCR.go('game:telacompro');
          }
        }, '🔨 ' + MCR.store.nameOf(active) + ' dijo «Te la compro»')
      )
    );
  }

  /* ---------- resolver ---------- */

  function viewResolver() {
    const alive = alivePlayers();
    const sel = alive.includes(S.sel) ? S.sel : null;

    if (!S.buyer) {
      return h('div', { class: 'grid' },
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Cerrar la ronda'),
          h('h2', { style: { fontSize: '24px' } }, '¿Quién dijo «te la compro»?'),
          h('div', { class: 'mt' }, MCR.ui.choiceGrid({ ids: alive, value: sel, key: 'buyer', onSelect: (id) => { S.sel = id; MCR.go('game:telacompro'); } }))
        ),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: () => { S.sel = null; S.step = 'ronda'; MCR.go('game:telacompro'); } }, '← Atrás')
        ),
        h('div', { class: 'action-bar' },
          h('div', { class: 'action-bar-info' }, sel ? 'Se confirma al tocar el botón' : 'Toca a quien compró'),
          MCR.ui.confirmBtn(sel, (n) => 'Confirmar · compró ' + n + ' →', (id) => {
            S.sel = null; S.buyer = id; S.challenged = previousBidder(id); MCR.go('game:telacompro');
          })
        )
      );
    }

    if (!S.challenged) {
      const others = alive.filter((id) => id !== S.buyer);
      const chalSel = others.includes(S.sel) ? S.sel : null;
      return h('div', { class: 'grid' },
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Comprador: ' + MCR.store.nameOf(S.buyer)),
          h('h2', { style: { fontSize: '24px' } }, '¿A quién se la compró?'),
          h('div', { class: 'mt' }, MCR.ui.choiceGrid({ ids: others, value: chalSel, key: 'chal', onSelect: (id) => { S.sel = id; MCR.go('game:telacompro'); } }))
        ),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: () => { S.sel = null; S.buyer = null; MCR.go('game:telacompro'); } }, '← Atrás')
        ),
        h('div', { class: 'action-bar' },
          h('div', { class: 'action-bar-info' }, chalSel ? 'Se confirma al tocar el botón' : 'Toca a quien le compraron'),
          MCR.ui.confirmBtn(chalSel, (n) => 'Confirmar · le compró a ' + n + ' →', (id) => {
            S.sel = null; S.challenged = id; MCR.go('game:telacompro');
          })
        )
      );
    }

    const eliminate = (id) => {
      S.eliminated.push(id);
      S.rounds.push({ category: S.category ? S.category.name : '—', buyer: S.buyer, challenged: S.challenged, out: id });
      S.category = null;
      S.buyer = null;
      S.challenged = null;

      const remaining = alivePlayers();
      // Rotación: cada ronda la abre la siguiente persona de la mesa.
      const played = S.rounds.filter((r) => !r.retired).length;
      S.turn = remaining.length ? played % remaining.length : 0;
      if (remaining.length <= 1) {
        S.step = 'fin';
      } else {
        S.step = 'ronda';
      }
      MCR.go('game:telacompro');
    };

    return h('div', { class: 'grid' },
      h('div', { class: 'panel center' },
        h('div', { class: 'eyebrow' }, 'La compra'),
        h('h2', { style: { fontSize: 'clamp(22px,3.2vw,30px)' } },
          MCR.store.nameOf(S.buyer) + ' le compró a ' + MCR.store.nameOf(S.challenged)),
        h('p', { class: 'stage-note', style: { margin: '12px auto 0' } },
          MCR.store.nameOf(S.challenged) + ' debe decir la cantidad que apostó. ¿Lo logró?'),
        h('div', { class: 'duel-actions mt' },
          h('button', { class: 'btn btn-danger btn-xl', onclick: () => eliminate(S.challenged) }, '✕ No lo logró · sale ' + MCR.store.nameOf(S.challenged)),
          h('button', { class: 'btn btn-ok btn-xl', onclick: () => eliminate(S.buyer) }, '✓ Sí lo logró · sale ' + MCR.store.nameOf(S.buyer))
        )
      ),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-ghost', onclick: () => { S.challenged = null; MCR.go('game:telacompro'); } }, 'Cambiar a quién le compró')
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
              h('div', { class: 'trow-meta' }, r.retired ? 'Se retiró' : r.category + ' · ' + MCR.store.nameOf(r.buyer) + ' le compró a ' + MCR.store.nameOf(r.challenged))
            )
          )
        ))
      ),
      MCR.ui.finishBar({
        route: 'game:telacompro',
        event: () => ({
          gameId: 'telacompro',
          playerIds: S.order.filter((id) => !S.rounds.some((r) => r.retired && r.out === id)),
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
