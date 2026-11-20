window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Juego 02 — Caricaturas eléctricas
   3 jugadores · categorías · 2 reemplazos (5 en total) · 2 finalistas

   Reglas de flujo (deben coincidir con el texto de viewRules):
     · Empiezan 3 (S.current). Cada eliminación usa un reemplazo mientras
       S.replaces < MAX_REPLACES y haya alguien disponible.
     · Sin reemplazos (agotados o sin gente) → con 2 en pie se juega la final.
     · Máximo de participantes: 3 + 2 = 5 (un solo ganador).
   ========================================================= */

(function () {
  const { h } = MCR.ui;
  const MAX_REPLACES = 2;

  let S = null;

  function reset() {
    S = {
      step: 'intro',
      current: [],
      eliminated: [],
      replaces: 0,
      category: null,
      winner: null,
      loser: null,
      picks: [],
      showUsedCats: false
    };
  }

  function render(root) {
    if (!S || root.dataset.newEntry === 'true') reset();
    root.dataset.view = S.step;
    const { root: g, body, foot } = MCR.ui.shell({
      title: 'Caricaturas eléctricas',
      sub: 'Palabras por categoría · Juego 02',
      backTo: 'home'
    });
    root.append(g);

    const views = {
      intro: viewIntro,
      rules: viewRules,
      setup: viewSetup,
      ronda: viewRonda,
      eliminar: viewEliminar,
      reemplazo: viewReemplazo,
      final: viewFinal,
      fin: viewFin
    };
    body.append(MCR.ui.gameFlow(S.step === 'intro' || S.step === 'rules' ? 0 : S.step === 'setup' ? 1 : 2));
    const view = (views[S.step] || viewSetup)();
    body.append(view);
    const actionBar = view.querySelector(':scope > .action-bar');
    if (actionBar) foot.append(actionBar);
    MCR.ui.gameNavigation({ root, view, foot, route: 'game:caricaturas', state: S, restore: (previous) => { S = previous; } });
  }

  function viewIntro() {
    return MCR.ui.gameIntro({
      kicker: 'Juego 02',
      title: 'Caricaturas eléctricas',
      summary: 'Respuestas rápidas por categoría: di una palabra que corresponda, sin repetir y sin trabarte. Quien falla deja su lugar a alguien nuevo.',
      details: ['Arrancan 3 personas', 'Hasta 2 reemplazos', 'Final de 2'],
      onContinue: () => { S.step = 'rules'; MCR.go('game:caricaturas'); }
    });
  }

  function viewRules() {
    return MCR.ui.gameRulesPage({
      title: 'Caricaturas eléctricas',
      script: '¡Tres valientes al frente! Les doy una categoría y, por turnos, cada quien dice algo que entre ahí: rapidito y sin repetir. ¿Te trabaste? ¿Repetiste? ¡Fuera! Entra alguien más y seguimos. Las dos últimas personas se juegan la final.',
      origin: 'En el programa: «Caricaturas eléctricas». Ahí, quien falla recibe una descarga y se va al sillón de la vergüenza.',
      goal: 'Ser la última persona en pie diciendo palabras de la categoría sin repetir ni trabarse.',
      steps: [
        'Arrancan tres personas. Quien conduce elige una categoría en la tablet y la anuncia en voz alta.',
        'Por turnos y sin pausas, cada quien dice una palabra que pertenezca a la categoría.',
        'Quien repite, se traba, tarda demasiado o dice algo que no corresponde queda fuera. Entra un reemplazo y se elige una categoría nueva.',
        'Hay 2 reemplazos, así que en total juegan 5. Cuando se acaban, la siguiente persona eliminada deja a dos finalistas, que se enfrentan con una última categoría.'
      ],
      win: 'Gana quien no falle en la final. Quien falla en la final queda en segundo lugar.',
      facts: [['Arrancan', '3 personas'], ['Reemplazos', 'Hasta 2'], ['Final', '1 contra 1']],
      special: [
        'Las categorías ya usadas se bloquean; «Permitir repetir usadas» las vuelve a habilitar.',
        'Si alguien se retira a media ronda, márcalo como eliminado: entra un reemplazo.',
        'Si ya no hay nadie disponible para reemplazar, se pasa directo a la final.',
        'El reemplazo sugerido es quien menos ha jugado en la fiesta.',
        'Si marcaste a la persona equivocada, usa «← Atrás».'
      ],
      onBack: () => { S.step = 'intro'; MCR.go('game:caricaturas'); },
      onContinue: () => { S.step = 'setup'; MCR.go('game:caricaturas'); }
    });
  }

  /* ---------- setup ---------- */


  function viewSetup() {
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Paso 2 · Preparación',
        title: 'Elige a los 3 que arrancan',
        sub: 'Los reemplazos se eligen durante el juego. «Le toca» marca a quienes menos han jugado; puedes elegir a cualquiera.'
      }),
      MCR.ui.peoplePicker({
        mode: 'pick',
        title: 'Arrancan',
        gameId: 'caricaturas',
        selected: S.picks,
        min: 3,
        max: 3,
        onChange: (ids) => { S.picks = ids; MCR.go('game:caricaturas'); },
        onAdd: (p) => {
          if (S.picks.length < 3 && !S.picks.includes(p.id)) S.picks.push(p.id);
          MCR.go('game:caricaturas');
        }
      }),
      MCR.ui.stepBar({
        back: () => { S.step = 'rules'; MCR.go('game:caricaturas'); },
        info: S.picks.length === 3 ? 'Tres participantes listos' : 'Elige exactamente 3',
        ok: S.picks.length === 3,
        disabled: S.picks.length !== 3,
        next: () => {
          S.current = S.picks.slice();
          S.step = 'ronda';
          MCR.go('game:caricaturas');
        },
        nextLabel: 'Comenzar juego →'
      })
    );
  }

  /* ---------- ronda ---------- */

  function categoryPicker(onPick) {
    const cats = MCR.store.get().content.categories;
    const usedSet = new Set(MCR.store.used('categories'));
    const usedCount = cats.filter((c) => usedSet.has(c.id)).length;
    const ordered = cats;
    const wrap = h('div', { class: 'opt-grid category-grid' });

    ordered.forEach((c) => {
      const isUsed = usedSet.has(c.id);
      wrap.append(h('button', {
        class: 'opt category-option' + (S.category && S.category.id === c.id ? ' sel' : '') + (isUsed ? ' used' : ''),
        disabled: isUsed && !S.showUsedCats,
        onclick: () => onPick(c)
      },
        h('span', { class: 'category-name' }, c.name),
        h('small', { class: 'category-status' }, isUsed ? 'Ya usada' : 'Disponible')
      ));
    });
    if (!cats.length) wrap.append(h('div', { class: 'empty' }, 'No hay categorías. Agrega algunas en Ajustes → Contenido.'));

    return h('div', { class: 'grid' },
      h('div', { class: 'row spread' },
        h('span', { class: 'tiny' }, usedCount + ' de ' + cats.length + ' categorías usadas'),
        h('button', {
          class: 'btn btn-quiet mini',
          onclick: () => { S.showUsedCats = !S.showUsedCats; MCR.go('game:caricaturas'); }
        }, S.showUsedCats ? 'Bloquear usadas' : 'Permitir repetir usadas')
      ),
      wrap
    );
  }

  function viewRonda() {
    const cat = S.category;

    if (cat) {
      return h('div', { class: 'grid' },
        h('div', { class: 'stage' },
          h('div', { class: 'stage-label' }, 'Categoría'),
          h('div', { class: 'stage-word mid' }, cat.name),
          h('div', { class: 'stage-note' }, 'En turnos y sin pausas: quien repita, se trabe o tarde, sale.'),
          h('button', { class: 'btn btn-quiet mini hide-in-visual', onclick: () => { S.category = null; MCR.go('game:caricaturas'); } }, 'Cambiar categoría')
        ),
        h('div', { class: 'panel hide-in-visual' },
          h('div', { class: 'row spread' },
            h('div', { class: 'panel-title' }, 'Jugadores en cancha'),
            h('span', { class: 'tiny' }, 'Reemplazos ' + S.replaces + ' / ' + MAX_REPLACES + ' · eliminados ' + S.eliminated.length)
          ),
          h('div', { class: 'heat mt-s' }, S.current.map((id) => h('span', { class: 'badge gold' }, MCR.store.nameOf(id))))
        ),
        // La acción que se repite toda la partida va en el pie, en el mismo lugar que «Continuar».
        h('div', { class: 'action-bar' },
          h('div', { class: 'action-bar-info' }, '¿Alguien repitió, se trabó o tardó? Sale y entra un reemplazo.'),
          h('button', { class: 'btn btn-gold btn-xl', onclick: () => { S.step = 'eliminar'; MCR.go('game:caricaturas'); } }, '🔄 Cambio →')
        )
      );
    }

    return h('div', { class: 'grid' },
      h('div', { class: 'panel' },
        h('div', { class: 'eyebrow' }, 'Ronda ' + (S.replaces + 1)),
        h('h2', { style: { fontSize: '26px' } }, 'Elige la categoría'),
        h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '8px 0 16px' } },
          'Anuncia la categoría y que respondan por turnos. Cuando alguien repita, se trabe o tarde, toca «Cambio»: sale y entra un reemplazo.'),
        categoryPicker((c) => {
          S.category = c;
          MCR.store.markUsed('categories', c.id);
          MCR.go('game:caricaturas');
        })
      )
    );
  }

  /* ---------- eliminar ---------- */

  function viewEliminar() {
    const sel = S.current.includes(S.sel) ? S.sel : null;
    const out = (id) => {
      S.sel = null;
      S.eliminated.push(id);
      S.current = S.current.filter((x) => x !== id);
      S.category = null;
      S.step = (S.replaces < MAX_REPLACES && replacementPool().length) ? 'reemplazo' : 'final';
      MCR.go('game:caricaturas');
    };
    return h('div', { class: 'grid' },
      h('div', { class: 'panel center' },
        h('div', { class: 'eyebrow' }, 'Cambio · ¿quién sale?'),
        h('h2', { style: { fontSize: 'clamp(22px,3.4vw,32px)', marginBottom: '18px' } }, 'Toca a quien quedó fuera'),
        MCR.ui.choiceGrid({ ids: S.current, value: sel, key: 'elim', onSelect: (id) => { S.sel = id; MCR.go('game:caricaturas'); } })
      ),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-ghost', onclick: () => { S.sel = null; S.step = 'ronda'; MCR.go('game:caricaturas'); } }, '← Atrás')
      ),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, sel ? 'Se confirma al tocar el botón' : 'Toca un nombre para marcarlo'),
        MCR.ui.confirmBtn(sel, (n) => 'Confirmar · sale ' + n + ' →', out)
      )
    );
  }

  /* ---------- reemplazo ---------- */

  /* Presentes que no han jugado en esta partida, ordenados por la rotación justa del store. */
  function replacementPool() {
    const busy = [].concat(S.current, S.eliminated);
    return MCR.store.recommend(Infinity, { gameId: 'caricaturas', exclude: busy });
  }

  function viewReemplazo() {
    const ordered = replacementPool();
    const sel = ordered.includes(S.sel) ? S.sel : null;
    const enter = (id) => {
      S.sel = null;
      S.current.push(id);
      S.replaces += 1;
      S.step = 'ronda';
      MCR.go('game:caricaturas');
    };

    return h('div', { class: 'grid' },
      MCR.ui.setupHead({
        step: 'Reemplazo ' + (S.replaces + 1) + ' de ' + MAX_REPLACES,
        title: '¿Quién entra?',
        sub: 'Arriba aparece quien menos ha jugado en la fiesta. Toca a alguien para marcarlo y confirma abajo.'
      }),
      MCR.ui.peoplePicker({
        mode: 'single',
        key: 'caricaturas-reemplazo',
        title: 'Disponibles',
        gameId: 'caricaturas',
        ids: ordered,
        selected: sel ? [sel] : [],
        onPick: (id) => { S.sel = sel === id ? null : id; MCR.go('game:caricaturas'); },
        emptyText: 'No queda nadie disponible para reemplazar. Escribe un nombre si llegó alguien.',
        onAdd: (p) => {
          if (S.current.includes(p.id) || S.eliminated.includes(p.id)) { MCR.ui.toast(p.name + ' ya jugó esta partida'); MCR.go('game:caricaturas'); return; }
          S.sel = p.id;
          MCR.go('game:caricaturas');
        }
      }),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, 'Quedan ' + S.current.length + ' en juego'),
        S.current.length >= 2 ? h('button', {
          class: 'btn btn-ghost',
          onclick: () => { S.sel = null; S.step = 'final'; MCR.go('game:caricaturas'); }
        }, 'Ir a la final sin reemplazo') : null,
        MCR.ui.confirmBtn(sel, (n) => '✓ Confirmar · entra ' + n, enter)
      )
    );
  }

  /* ---------- final ---------- */

  function viewFinal() {
    const cat = S.category;
    const winSel = S.current.includes(S.sel) ? S.sel : null;

    if (!cat) {
      return h('div', { class: 'grid' },
        h('div', { class: 'panel' },
          h('div', { class: 'eyebrow' }, 'Gran final'),
          h('h2', { style: { fontSize: '26px' } }, 'Elige la categoría final'),
          h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '8px 0 16px' } },
            'Quedan ' + MCR.ui.playerList(S.current) + '. Una sola categoría decide.'),
          categoryPicker((c) => {
            S.category = c;
            MCR.store.markUsed('categories', c.id);
            MCR.go('game:caricaturas');
          })
        )
      );
    }

    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Categoría final'),
        h('div', { class: 'stage-word mid' }, cat.name)
      ),
      h('div', { class: 'panel hide-in-visual' },
        h('div', { class: 'panel-title' }, '¿Quién ganó?'),
        MCR.ui.choiceGrid({ ids: S.current, value: winSel, key: 'win', onSelect: (id) => { S.sel = id; MCR.go('game:caricaturas'); } }),
        h('div', { class: 'btn-row mt' },
          h('button', { class: 'btn btn-quiet mini', onclick: () => { S.sel = null; S.category = null; MCR.go('game:caricaturas'); } }, 'Cambiar categoría')
        )
      ),
      h('div', { class: 'action-bar' },
        h('div', { class: 'action-bar-info' }, winSel ? 'Se confirma al tocar el botón' : 'Toca a quien ganó'),
        MCR.ui.confirmBtn(winSel, (n) => '🏆 Confirmar · ganó ' + n, (id) => {
          S.sel = null;
          S.winner = id;
          S.loser = S.current.find((x) => x !== id);
          S.step = 'fin';
          MCR.go('game:caricaturas');
        })
      )
    );
  }

  /* ---------- fin ---------- */

  function viewFin() {
    return h('div', { class: 'grid' },
      h('div', { class: 'stage' },
        h('div', { class: 'stage-label' }, 'Ganador'),
        h('div', { class: 'stage-word' }, MCR.store.nameOf(S.winner)),
        h('div', { class: 'stage-note' }, 'Segundo lugar: ' + MCR.store.nameOf(S.loser))
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Orden de salida'),
        h('div', { class: 'heat' },
          S.eliminated.map((id, i) => h('span', { class: 'badge warn' }, (i + 1) + '. ' + MCR.store.nameOf(id))),
          h('span', { class: 'badge' }, '2º ' + MCR.store.nameOf(S.loser)),
          h('span', { class: 'badge ok' }, '🏆 ' + MCR.store.nameOf(S.winner))
        )
      ),
      MCR.ui.finishBar({
        route: 'game:caricaturas',
        event: () => ({
          gameId: 'caricaturas',
          playerIds: Array.from(new Set([].concat(S.current, S.eliminated, [S.winner, S.loser]))),
          winners: [S.winner],
          meta: { loser: S.loser, replaces: S.replaces, eliminated: S.eliminated.slice() }
        }),
        again: () => { reset(); S.step = 'setup'; },
        reset
      })
    );
  }

  MCR.screens['game:caricaturas'] = render;
})();
