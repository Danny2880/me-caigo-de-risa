window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};

/* =========================================================
   Herramienta — Formar equipos
   No es un juego: no registra partidas. Se elige cuántos equipos (2 o 3),
   quiénes participan, y la app mezcla con MCR.store.makeTeams (diferencia
   máxima de 1 entre equipos y evita repetir compañeros recientes).
   ========================================================= */

(function () {
  const { h } = MCR.ui;
  const ROUTE = 'game:equipos';
  let S = null;

  function reset() {
    S = { step: 'setup', k: 2, active: null, teams: [] };
  }

  function allIds() { return MCR.store.players().map((p) => p.id); }

  function mix() {
    S.teams = MCR.store.makeTeams(S.active.slice(), S.k);
    S.step = 'teams';
    MCR.go(ROUTE);
  }

  function render(root) {
    if (!S || root.dataset.newEntry === 'true') reset();
    root.dataset.view = S.step;
    const { root: g, body, foot } = MCR.ui.shell({ title: 'Formar equipos', sub: 'Herramienta', backTo: 'catalog' });
    root.append(g);
    const view = S.step === 'teams' ? viewTeams() : viewSetup();
    body.append(view);
    const bar = view.querySelector(':scope > .action-bar');
    if (bar) foot.append(bar);
  }

  function viewSetup() {
    if (S.active == null) S.active = allIds();
    const ready = S.active.length >= S.k;
    return h('div', { class: 'grid' },
      MCR.ui.setupHead({ title: '¿Cuántos equipos?', sub: 'Elige 2 o 3 y toca a quien vaya a descansar.' }),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Número de equipos' }, [2, 3].map((k) =>
        h('button', { class: 'btn' + (S.k === k ? ' seg-on' : ''), 'aria-pressed': String(S.k === k),
          onclick: () => { S.k = k; MCR.go(ROUTE); } }, k + ' equipos')
      )),
      MCR.ui.peoplePicker({
        mode: 'roster',
        gameId: 'equipos',
        ids: allIds(),
        selected: S.active,
        min: S.k,
        onChange: (ids) => { S.active = ids; MCR.go(ROUTE); },
        onAdd: (p) => { if (!S.active.includes(p.id)) S.active.push(p.id); MCR.go(ROUTE); }
      }),
      MCR.ui.stepBar({
        back: () => MCR.go('catalog'),
        info: ready ? S.active.length + ' personas · ' + S.k + ' equipos' : 'Mínimo ' + S.k + ' personas',
        ok: ready,
        disabled: !ready,
        next: mix,
        nextLabel: '🎲 Formar equipos →'
      })
    );
  }

  function viewTeams() {
    return h('div', { class: 'grid' },
      h('div', { class: 'eq-grid eq-' + S.k }, S.teams.map((team, i) =>
        h('section', { class: 'panel eq-team eq-team-' + i },
          h('div', { class: 'eq-head' },
            h('h2', { class: 'eq-name' }, 'Equipo ' + (i + 1)),
            h('span', { class: 'badge' }, team.length + (team.length === 1 ? ' persona' : ' personas'))
          ),
          h('ol', { class: 'eq-list' }, team.map((id) => h('li', null, MCR.store.nameOf(id))))
        )
      )),
      h('div', { class: 'action-bar' },
        h('button', { class: 'btn btn-ghost', onclick: () => { S.step = 'setup'; MCR.go(ROUTE); } }, '← Cambiar participantes'),
        h('button', { class: 'btn btn-ghost', onclick: mix }, '🎲 Mezclar otra vez'),
        h('button', { class: 'btn btn-gold btn-xl', onclick: () => MCR.go('catalog') }, 'Listo · ir a Juegos →')
      )
    );
  }

  MCR.screens[ROUTE] = render;
})();
