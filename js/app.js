window.MCR = window.MCR || {};
MCR.screens = MCR.screens || {};
MCR.BUILD = '2026-11-16 · v11 · pantallas de juego';
console.info('Me caigo de risa · build', MCR.BUILD);

/* =========================================================
   Arranque, navegación y pantallas base
   ========================================================= */

(function () {
  const { h } = MCR.ui;
  const screens = MCR.screens;

  MCR.go = function (id, params) {
    const app = document.getElementById('app');
    const previous = app.firstElementChild;
    const sameRoute = previous && previous.dataset.route === id;
    if (!sameRoute && MCR.disposeGame) {
      MCR.disposeGame();
      MCR.disposeGame = null;
    }
    const scrollSelectors = ['.game-body', '.view', '.pick-scroll'];
    const scroll = sameRoute ? scrollSelectors.flatMap((selector) =>
      Array.from(previous.querySelectorAll(selector), (el, index) => ({
        selector, index, top: el.scrollTop, left: el.scrollLeft
      }))
    ) : [];
    const active = document.activeElement;
    const focusKey = sameRoute && previous.contains(active) ? active.getAttribute('data-focus-key') : null;
    MCR.route = { id, params };
    const host = h('div', { class: 'host', 'data-route': id });
    if (!sameRoute && id.startsWith('game:')) host.dataset.newEntry = 'true';
    const fn = screens[id] || screens.home;
    // Construir fuera de pantalla evita vaciar la vista mientras se actualiza.
    fn(host, params);
    const sameView = sameRoute && previous.dataset.view === host.dataset.view;
    MCR.applyTheme();
    app.replaceChildren(host);
    if (sameView) {
      if (focusKey) {
        const target = Array.from(host.querySelectorAll('[data-focus-key]'))
          .find((el) => el.getAttribute('data-focus-key') === focusKey);
        if (target && !target.disabled) target.focus({ preventScroll: true });
      }
      // Restaurar antes de pintar, tanto el panel principal como sus listas.
      scroll.forEach(({ selector, index, top, left }) => {
        const el = host.querySelectorAll(selector)[index];
        if (el) { el.scrollTop = top; el.scrollLeft = left; }
      });
    }
  };

  /* Vuelve a pintar la pantalla actual (p. ej. tras «Deshacer» un registro). */
  MCR.refresh = function () {
    if (MCR.route) MCR.go(MCR.route.id, MCR.route.params);
  };

  /* ---------- barra superior ---------- */

  function topbar(active) {
    const items = [
      ['home', 'Inicio', 'M10 3 2 9v12h6v-7h4v7h6V9l-8-6Z'],
      ['catalog', 'Juegos', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
      ['players', 'Jugadores', 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3a4 4 0 0 1 2 4v2'],
      ['settings', 'Ajustes', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6']
    ];
    return h('header', { class: 'topbar' },
      h('div', { class: 'topbar-inner' },
        h('button', { class: 'brand', onclick: () => MCR.go('home') },
          h('div', { class: 'brand-mark' }, '☠'),
          h('div', { class: 'brand-txt' },
            h('span', { class: 'brand-name' }, 'Me caigo de risa'),
            h('span', { class: 'brand-sub' }, 'El desafío ', h('span', { class: 'build-tag' }, 'v2'))
          )
        ),
        navItems(items, active)
      )
    );
  }

  function navItems(items, active) {
    return h('nav', { class: 'nav', 'aria-label': 'Navegación principal' }, items.map(([id, label, path]) =>
      h('button', {
        class: 'nav-btn' + (active === id ? ' on' : ''),
        'aria-current': active === id ? 'page' : null,
        onclick: () => MCR.go(id)
      }, navIcon(path), h('span', { class: 'nav-label' }, label))
    ));
  }

  MCR.bottomNav = function (active) {
    return navItems([
      ['home', 'Inicio', 'M10 3 2 9v12h6v-7h4v7h6V9l-8-6Z'],
      ['catalog', 'Juegos', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
      ['players', 'Jugadores', 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3a4 4 0 0 1 2 4v2'],
      ['settings', 'Ajustes', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6']
    ], active || 'catalog');
  };

  function navIcon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'nav-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    return svg;
  }

  MCR.topbar = topbar;
  MCR.applyTheme = function () {
    const dark = MCR.store.get().settings.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  };

  /* ---------- inicio ---------- */

  function statsLine() {
    const st = MCR.store.stats();
    const total = MCR.store.players().length;   // solo presentes
    const never = MCR.store.players().filter((p) => !(st[p.id] || {}).plays).length;
    const events = MCR.store.get().events.length;
    return { total, never, events, st };
  }

  function participationMap() {
    const wrap = h('div', { class: 'pmap' });
    /* El número grande es cuántas PARTIDAS jugó cada quien (+1 por cada partida
       registrada en la que participó, haya ganado o perdido). Quien menos ha jugado
       va primero: es a quien le toca. Las victorias son solo un dato extra. */
    const list = MCR.store.rank().slice().sort((a, b) => {
      if (!!a.absent !== !!b.absent) return a.absent ? 1 : -1;
      if ((a.plays || 0) !== (b.plays || 0)) return (a.plays || 0) - (b.plays || 0);
      return a.name.localeCompare(b.name, 'es');
    });
    list.forEach((p, i) => {
      const plays = p.plays || 0;
      const wins = p.wins || 0;
      wrap.append(h('div', {
        class: 'pmap-cell' + (p.absent ? ' is-absent' : ''),
        'data-p': String(Math.min(4, plays)),
        title: p.name + ' · jugó ' + plays + (plays === 1 ? ' partida' : ' partidas') + (wins ? ' · ganó ' + wins : '')
      },
        h('div', { class: 'pmap-rank' }, String(i + 1)),
        h('div', { class: 'pmap-info' },
          h('div', { class: 'pmap-name' }, p.name),
          h('div', { class: 'pmap-sub' }, p.absent ? 'ausente' : !plays ? 'aún no juega' : wins ? '🏆 ganó ' + wins : '\u00a0')
        ),
        h('div', { class: 'center' },
          h('div', { class: 'pmap-num' }, String(plays)),
          h('div', { class: 'pmap-lbl' }, plays === 1 ? 'partida' : 'partidas')
        )
      ));
    });
    return wrap;
  }

  function mapLegend() {
    // Los colores salen de las mismas clases que las celdas (data-p), así respetan el tema.
    return h('div', { class: 'heat-legend' },
      ['0', '1', '2', '3', '4 o más'].map((label, i) => h('span', null, h('i', { class: 'heat-swatch', 'data-p': String(i) }), label))
    );
  }

  MCR.ui.participationMap = participationMap;
  MCR.ui.mapLegend = mapLegend;

  screens.home = function (root) {
    root.append(topbar('home'));
    const { total, never, events } = statsLine();
    const view = h('div', { class: 'view' });

    view.append(
      h('div', { class: 'hero' },
        h('div', { class: 'eyebrow' }, 'Fiesta pirata · cumpleaños'),
        h('h1', { class: 'hero-title' }, 'Me caigo de risa', h('em', null, 'El desafío')),
        h('p', { class: 'hero-sub' },
          'Siete juegos, una sola tablet. La app reparte equipos, lleva el tiempo y el marcador, y sugiere quién juega para que todos participen.')
      ),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(total)), h('div', { class: 'stat-l' }, 'presentes')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(never)), h('div', { class: 'stat-l' }, 'aún sin jugar')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(events)), h('div', { class: 'stat-l' }, 'partidas')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, '7'), h('div', { class: 'stat-l' }, 'juegos'))
      ),
      h('div', { class: 'home-games-link' },
        h('div', null,
          h('strong', null, '¿Listos para jugar?'),
          h('span', null, never ? never + (never === 1 ? ' persona presente aún no juega: las sugerencias la ponen primero.' : ' personas presentes aún no juegan: las sugerencias las ponen primero.') : 'Todos los presentes ya jugaron al menos una vez.')
        ),
        h('button', { class: 'btn btn-gold', onclick: () => MCR.go('catalog') }, 'Ir a Juegos →')
      ),
      h('div', { class: 'panel mt' },
        h('div', { class: 'row spread' },
          h('div', { class: 'panel-title', style: { margin: 0 } }, 'Partidas jugadas por persona'),
          h('button', { class: 'btn btn-ghost mini', onclick: () => MCR.go('players') }, 'Pasar lista →')
        ),
        h('div', { class: 'mt' }, MCR.ui.participationMap()),
        MCR.ui.mapLegend()
      )
    );

    root.append(view);
  };

  /* ---------- catálogo ---------- */

  screens.catalog = function (root) {
    root.append(topbar('catalog'));
    const view = h('div', { class: 'view' });

    const custom = MCR.store.get().customGames || [];

    view.append(
      h('div', { class: 'page-intro' },
        h('div', { class: 'eyebrow' }, 'Catálogo'),
        h('h1', { class: 'page-h1' }, 'Los 7 juegos')
      ),
      h('div', { class: 'grid grid-cards mt' }, MCR.data.games.map((g) =>
        h('div', { class: 'card game-card' },
          h('div', { class: 'card-top' },
            h('div', { class: 'card-num' }, String(g.n).padStart(2, '0')),
            h('div', { class: 'grow' },
              h('div', { class: 'card-title' }, g.name),
              h('div', { class: 'card-sub' }, g.sub)
            )
          ),
          h('div', { class: 'card-foot' },
            h('span', { class: 'badge' }, g.tag),
            h('span', { class: 'badge gold' }, g.players)
          ),
          h('button', { class: 'btn btn-gold btn-block', onclick: () => MCR.go('game:' + g.id) }, 'Abrir →')
        )
      )),
      h('div', { class: 'row spread mt' },
        h('h2', { style: { fontSize: '22px' } }, 'Juegos propios'),
        h('button', { class: 'btn btn-ghost', onclick: () => MCR.go('custom:new') }, '+ Añadir juego')
      ),
      custom.length
        ? h('div', { class: 'grid grid-2 mt-s' }, custom.map((g) =>
            h('div', { class: 'card', style: { cursor: 'default' } },
              h('div', { class: 'card-title' }, g.name),
              h('div', { class: 'card-sub' }, g.sub || 'Juego personalizado'),
              h('div', { class: 'card-foot' },
                h('button', { class: 'btn btn-gold', style: { minHeight: '40px', padding: '8px 16px' }, onclick: () => MCR.go('custom:play', g.id) }, 'Abrir'),
                h('button', { class: 'btn btn-ghost', style: { minHeight: '40px', padding: '8px 16px' }, onclick: () => MCR.go('custom:new', g.id) }, 'Editar')
              )
            )
          ))
        : h('div', { class: 'empty mt-s' }, 'Aún no hay juegos propios. Puedes crear uno con portada, reglas y temporizador opcional.')
    );

    root.append(view);
  };
})();

/* ---------- jugadores ----------
   Esta pantalla es el «pase de lista» de la fiesta:
   · Presente/ausente decide quién aparece en los juegos (MCR.store.players()).
   · Eliminar a alguien con partidas solo lo archiva: su historial sigue intacto.
   · El historial permite borrar una partida registrada por error; las
     estadísticas y la rotación se recalculan solas. */

(function () {
  const { h } = MCR.ui;

  function editPlayer(p) {
    const input = h('input', { class: 'input', value: p.name, 'aria-label': 'Nombre' });
    MCR.ui.dialog({
      title: 'Corregir nombre',
      body: input,
      actions: [
        { label: 'Cancelar', value: false, kind: 'ghost' },
        { label: 'Guardar', value: true }
      ]
    }).then((ok) => {
      if (!ok) return;
      if (MCR.store.renamePlayer(p.id, input.value)) MCR.ui.toast('Nombre actualizado');
      else MCR.ui.toast('Ese nombre está vacío o ya lo usa otra persona');
      MCR.go('players');
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }

  function deletePlayer(p, plays) {
    const msg = plays
      ? p.name + ' tiene ' + plays + (plays === 1 ? ' partida registrada' : ' partidas registradas') + '. Saldrá de la lista, pero su historial se conserva. Si solo no está hoy, mejor márcalo como ausente.'
      : '¿Quitar a ' + p.name + ' de la lista?';
    MCR.ui.confirm('Eliminar jugador', msg, 'Sí, eliminar', true)
      .then((ok) => {
        if (!ok) return;
        MCR.store.removePlayer(p.id);
        MCR.go('players');
        MCR.ui.toast(p.name + ' se eliminó de la lista', {
          action: { label: 'Deshacer', onClick: () => { MCR.store.addPlayer(p.name); MCR.go('players'); } }
        });
      });
  }

  function gameName(id) {
    const g = MCR.data.games.find((x) => x.id === id);
    return g ? g.name : id;
  }

  function when(at) {
    const d = new Date(at);
    const today = new Date();
    const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === today.toDateString() ? 'Hoy ' + time : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' ' + time;
  }

  function historyPanel() {
    const events = MCR.store.get().events.slice().reverse();
    return h('section', { class: 'panel mt history-panel' },
      h('div', { class: 'row spread' },
        h('h2', { class: 'panel-title' }, 'Partidas registradas'),
        h('span', { class: 'badge' }, String(events.length))
      ),
      h('p', { class: 'roster-note' }, 'Si un resultado se registró mal, bórralo aquí: las estadísticas y las sugerencias se recalculan solas.'),
      events.length ? h('div', { class: 'list' }, events.slice(0, 30).map((ev) =>
        h('div', { class: 'trow history-row' },
          h('div', { class: 'grow' },
            h('div', { class: 'trow-name' }, gameName(ev.gameId)),
            h('div', { class: 'trow-meta' },
              when(ev.at) + ' · ' + ev.players.length + (ev.players.length === 1 ? ' persona' : ' personas') +
              (ev.winners.length ? ' · 🏆 ' + ev.winners.map(MCR.store.nameOf).join(', ') : ' · sin ganador'))
          ),
          h('button', {
            class: 'btn btn-ghost mini', 'aria-label': 'Borrar registro de ' + gameName(ev.gameId),
            onclick: () => MCR.ui.confirm('Borrar registro', 'Se elimina esta partida de ' + gameName(ev.gameId) + ' (' + when(ev.at) + '). Las estadísticas se recalculan.', 'Borrar', true)
              .then((ok) => { if (ok) { MCR.store.removeEvent(ev.id); MCR.ui.toast('Registro borrado'); MCR.go('players'); } })
          }, 'Borrar')
        )
      )) : h('div', { class: 'empty mt-s' }, 'Todavía no hay partidas registradas.')
    );
  }

  MCR.screens.players = function (root) {
    root.append(MCR.topbar('players'));

    const view = h('div', { class: 'view' });
    const input = h('input', {
      class: 'input',
      placeholder: 'Nombre de quien llega',
      'aria-label': 'Nombre del nuevo jugador'
    });

    const add = () => {
      if (!input.value.trim()) return;
      const p = MCR.store.addPlayer(input.value);
      input.value = '';
      MCR.go('players');
      MCR.ui.toast(p.reused ? (p.wasAway ? p.name + ' ya estaba en la lista: ahora aparece como presente' : p.name + ' ya estaba en la lista') : p.name + ' se agregó');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const st = MCR.store.stats();
    const all = MCR.store.roster().slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    const present = all.filter((p) => !p.absent);
    const absent = all.filter((p) => p.absent);

    const row = (p) => {
      const s = st[p.id] || { plays: 0, wins: 0 };
      const isPresent = !p.absent;
      return h('div', { class: 'trow player-manage-row' + (isPresent ? '' : ' is-absent') },
        MCR.ui.avatar(p.name),
        h('div', { class: 'grow' },
          h('div', { class: 'trow-name' }, p.name),
          h('div', { class: 'trow-meta' }, (s.plays ? 'Jugó ' + s.plays + (s.plays === 1 ? ' partida' : ' partidas') : 'Aún no juega') + (s.wins ? ' · 🏆 ganó ' + s.wins : ''))
        ),
        h('button', {
          class: 'presence-toggle' + (isPresent ? ' on' : ''),
          role: 'switch',
          'aria-checked': String(isPresent),
          'aria-label': p.name + (isPresent ? ' está presente' : ' está ausente'),
          'data-focus-key': 'presence-' + p.id,
          onclick: () => { MCR.store.setPresent(p.id, !isPresent); MCR.go('players'); }
        }, h('span', { class: 'presence-knob' }), h('span', { class: 'presence-txt' }, isPresent ? 'Presente' : 'Ausente')),
        h('button', { class: 'icon-btn quiet', title: 'Corregir nombre', 'aria-label': 'Corregir nombre de ' + p.name, onclick: () => editPlayer(p) }, '✏️'),
        h('button', { class: 'icon-btn quiet danger', title: 'Eliminar', 'aria-label': 'Eliminar a ' + p.name, onclick: () => deletePlayer(p, s.plays) }, '🗑️')
      );
    };

    /* Con muchas personas, filtrar por nombre sin repintar (no pierde el foco). */
    function listFilter() {
      const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const box = h('input', { class: 'input pp-search', type: 'search', placeholder: 'Buscar en la lista…', 'aria-label': 'Buscar jugador' });
      box.addEventListener('input', () => {
        const q = norm(box.value.trim());
        view.querySelectorAll('.player-management-list > *').forEach((el) => {
          const name = el.querySelector('.trow-name');
          el.hidden = !!q && !(name && norm(name.textContent).includes(q));
        });
      });
      return h('div', { class: 'pp-search-wrap mt-s' }, MCR.ui.searchIcon(), box);
    }

    view.append(
      h('div', { class: 'page-intro' },
        h('h1', { class: 'page-h1' }, 'Jugadores'),
        h('p', { class: 'hero-sub' }, 'Pasa lista: solo las personas presentes aparecen en los juegos y en las sugerencias.')
      ),
      h('div', { class: 'panel add-panel' },
        h('label', { class: 'panel-title', for: 'new-player' }, 'Añadir a alguien'),
        h('div', { class: 'quick-add' }, Object.assign(input, { id: 'new-player' }), h('button', { class: 'btn btn-gold', onclick: add }, 'Agregar')),
        h('p', { class: 'roster-note' }, 'Si el nombre ya existe no se duplica: esa persona vuelve como presente.')
      ),
      h('div', { class: 'panel mt' },
        h('div', { class: 'row spread roster-head' },
          h('h2', { class: 'panel-title' }, 'Lista de hoy'),
          h('div', { class: 'row' },
            h('span', { class: 'badge ok' }, present.length + ' presentes'),
            absent.length ? h('span', { class: 'badge' }, absent.length + ' ausentes') : null,
            absent.length ? h('button', { class: 'btn btn-ghost mini', onclick: () => { absent.forEach((p) => MCR.store.setPresent(p.id, true)); MCR.go('players'); } }, 'Marcar a todos presentes') : null
          )
        ),
        all.length > 8 ? listFilter() : null,
        all.length ? h('div', { class: 'list player-management-list' }, present.concat(absent).map(row))
          : h('div', { class: 'empty mt-s' }, 'Todavía no hay jugadores. Añade el primero arriba.')
      ),
      historyPanel()
    );

    root.append(view);
  };
})();

/* ---------- ajustes ---------- */

(function () {
  const { h } = MCR.ui;

  MCR.screens.settings = function (root) {
    root.append(MCR.topbar('settings'));
    const view = h('div', { class: 'view' });

    const fileInput = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        MCR.ui.confirm(
          'Restaurar respaldo',
          'La copia reemplazará los datos actuales de esta aplicación. ¿Quieres continuar?',
          'Sí, restaurar',
          true
        ).then((ok) => {
          if (!ok) return;
          try {
            MCR.store.importJSON(String(reader.result));
            MCR.ui.toast('Copia restaurada');
            MCR.go('home');
          } catch (e) {
            MCR.ui.toast('Archivo no válido');
          }
        });
      };
      reader.readAsText(f);
    });

    const exportBtn = () => {
      const blob = new Blob([MCR.store.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: 'me-caigo-de-risa-respaldo.json' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      MCR.ui.toast('Respaldo descargado');
    };

    const resetDeck = (key, label) => {
      MCR.ui.confirm(
        'Reiniciar ' + label,
        'El contenido usado de ' + label + ' volverá a estar disponible. El historial se conserva.',
        'Sí, reiniciar',
        false
      ).then((ok) => {
        if (!ok) return;
        MCR.store.resetUsed(key);
        MCR.ui.toast('Mazo de ' + label + ' reiniciado');
        MCR.go('settings');
      });
    };
    const darkMode = MCR.store.get().settings.theme === 'dark';

    view.append(
      h('div', { class: 'page-intro' },
        h('h1', { class: 'page-h1' }, 'Ajustes')
      ),

      h('div', { class: 'panel appearance-panel' },
        h('div', { class: 'appearance-copy' },
          h('h2', null, 'Apariencia'),
          h('p', null, darkMode ? 'Modo oscuro activado' : 'Modo claro activado')
        ),
        h('button', {
          class: 'theme-toggle' + (darkMode ? ' on' : ''),
          role: 'switch',
          'aria-checked': String(darkMode),
          'aria-label': darkMode ? 'Desactivar modo oscuro' : 'Activar modo oscuro',
          onclick: () => {
            MCR.store.get().settings.theme = darkMode ? 'light' : 'dark';
            MCR.store.save();
            MCR.go('settings');
          }
        }, h('span', { class: 'theme-toggle-knob' }))
      ),

      h('div', { class: 'panel appearance-panel' },
        h('div', { class: 'appearance-copy' },
          h('h2', null, 'Contenido de los juegos'),
          h('p', { class: 'settings-summary' },
            'Administra películas, categorías, sílabas, pares de letras y palabras.')
        ),
        h('button', { class: 'btn btn-gold', onclick: () => MCR.go('content') }, '🗂️ Abrir gestor →')
      ),

      h('div', { class: 'panel mt' },
        h('div', { class: 'panel-title' }, 'Reiniciar contenido usado'),
        h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '0 0 14px' } },
          'Al reiniciar un mazo, sus elementos usados vuelven a estar disponibles para jugar.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: () => resetDeck('movies', 'películas') }, 'Reiniciar mazo de películas'),
          h('button', { class: 'btn btn-ghost', onclick: () => resetDeck('letterPairs', 'pares de letras') }, 'Reiniciar pares de letras'),
          h('button', { class: 'btn btn-ghost', onclick: () => resetDeck('categories', 'categorías') }, 'Reiniciar categorías')
        )
      ),

      h('div', { class: 'panel mt' },
        h('div', { class: 'panel-title' }, 'Respaldo'),
        h('p', { class: 'stage-note', style: { textAlign: 'left', margin: '0 0 14px' } },
          'Todo vive en este dispositivo. Descarga una copia antes de la fiesta por si acaso.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', onclick: exportBtn }, '⬇️ Descargar respaldo'),
          h('button', { class: 'btn btn-ghost', onclick: () => fileInput.click() }, '⬆️ Restaurar respaldo')
        ),
        fileInput
      ),

      h('div', { class: 'panel mt' },
        h('div', { class: 'panel-title' }, 'Zona de riesgo'),
        h('div', { class: 'btn-row' },
          h('button', {
            class: 'btn btn-danger',
            onclick: () => {
              MCR.ui.confirm('Borrar historial', 'Se borran todas las partidas y victorias. Los jugadores y el contenido se conservan.', 'Borrar historial', true)
                .then((ok) => {
                  if (!ok) return;
                  MCR.store.get().events = [];
                  MCR.store.get().teams = [];
                  MCR.store.save();
                  MCR.ui.toast('Historial borrado');
                  MCR.go('settings');
                });
            }
          }, 'Borrar historial'),
          h('button', {
            class: 'btn btn-danger',
            onclick: () => {
              MCR.ui.confirm('Restablecer todo', 'Se borran jugadores, historial y contenido personalizado. Vuelve a la lista inicial.', 'Restablecer todo', true)
                .then((ok) => {
                  if (!ok) return;
                  MCR.store.resetAll();
                  MCR.ui.toast('Todo restablecido');
                  MCR.go('home');
                });
            }
          }, 'Restablecer todo')
        )
      ),

      h('div', { class: 'panel mt' },
        h('div', { class: 'panel-title' }, 'Versión de la app'),
        h('p', { class: 'stage-note', style: { textAlign: 'left', margin: 0 } },
          'Build ' + MCR.BUILD + '. Si no ves el diseño nuevo, cierra la pestaña y vuelve a abrir la dirección.')
      )
    );

    root.append(view);
  };
})();

/* ---------- gestor de contenido ---------- */

(function () {
  const { h } = MCR.ui;

  const TABS = {
    movies:      { label: 'Películas',   fields: [{ k: 'title', l: 'Película' }] },
    lipWords:    { label: 'Sin palabras', fields: [{ k: 'w', l: 'Palabra' }], strings: true },
    syllablesIni:{ label: 'Sílabas',     fields: [{ k: 's', l: 'Sílaba' }] },
    syllablesFin:{ label: 'Terminaciones', fields: [{ k: 's', l: 'Terminación' }] },
    letterPairs: { label: 'Pares de letras', fields: [{ k: 'a', l: 'Inicial' }, { k: 'b', l: 'Final' }] },
    categories:  { label: 'Categorías',  fields: [{ k: 'name', l: 'Categoría' }] }
  };

  let tab = 'movies';

  function contentOf() { return MCR.store.get().content; }

  function summary(def, item) {
    if (def.strings) return item;
    if (tab === 'movies') return item.title;
    if (tab === 'letterPairs') return item.a + ' — ' + item.b;
    if (tab === 'categories') return item.name;
    return item.s || '';
  }

  function addItem(def, values) {
    const content = contentOf();
    if (def.strings) {
      const v = String(values.w || '').trim();
      if (!v) return;
      content[tab].push(v);
    } else {
      const obj = { id: MCR.store.uid('ct_') };
      def.fields.forEach((f) => { obj[f.k] = String(values[f.k] || '').trim(); });
      if (!obj[def.fields[0].k]) return;
      content[tab].push(obj);
    }
    MCR.store.save();
    MCR.ui.toast('Agregado');
    MCR.go('content');
  }

  function editItem(def, index, item) {
    const inputs = {};
    const body = h('div', { class: 'grid' });
    if (def.strings) {
      inputs.w = h('input', { class: 'input', value: item });
      body.append(inputs.w);
    } else {
      def.fields.forEach((f) => {
        inputs[f.k] = h('input', { class: 'input', value: item[f.k] || '' });
        body.append(h('div', null, h('div', { class: 'tiny', style: { marginBottom: '6px' } }, f.l), inputs[f.k]));
      });
    }
    MCR.ui.dialog({
      title: 'Editar',
      body,
      actions: [{ label: 'Cancelar', value: false, kind: 'ghost' }, { label: 'Guardar', value: true }]
    }).then((ok) => {
      if (!ok) return;
      const content = contentOf();
      if (def.strings) content[tab][index] = inputs.w.value.trim();
      else def.fields.forEach((f) => { content[tab][index][f.k] = inputs[f.k].value.trim(); });
      MCR.store.save();
      MCR.ui.toast('Guardado');
      MCR.go('content');
    });
  }

  function removeItem(def, index) {
    MCR.ui.confirm('Eliminar', '¿Eliminar «' + summary(def, contentOf()[tab][index]) + '»?', 'Eliminar', true)
      .then((ok) => {
        if (!ok) return;
        contentOf()[tab].splice(index, 1);
        MCR.store.save();
        MCR.ui.toast('Eliminado');
        MCR.go('content');
      });
  }

  MCR.screens.content = function (root) {
    root.append(MCR.topbar('settings'));
    const view = h('div', { class: 'view content-manager-view' });
    const def = TABS[tab];
    const list = contentOf()[tab] || [];
    const ordered = list.map((item, index) => ({ item, index })).sort((a, b) =>
      summary(def, a.item).localeCompare(summary(def, b.item), 'es', { sensitivity: 'base', numeric: true }));

    const inputs = {};
    const form = h('div', { class: 'row' });
    def.fields.forEach((f) => {
      inputs[f.k] = h('input', { class: 'input', placeholder: f.l, style: { flex: '1 1 160px' } });
      form.append(inputs[f.k]);
    });
    form.append(h('button', {
      class: 'btn btn-gold',
      onclick: () => {
        const values = {};
        def.fields.forEach((f) => { values[f.k] = inputs[f.k].value; });
        addItem(def, values);
      }
    }, 'Agregar'));

    view.append(
      h('div', { class: 'page-intro' },
        h('div', { class: 'eyebrow' }, 'Gestor'),
        h('h1', { class: 'page-h1' }, 'Contenido')
      ),
      h('div', { class: 'content-tabs', role: 'group', 'aria-label': 'Tipo de contenido' }, Object.keys(TABS).map((k) =>
        h('button', {
          class: 'content-tab' + (tab === k ? ' on' : ''),
          'aria-pressed': String(tab === k),
          onclick: () => { tab = k; MCR.go('content'); }
        }, TABS[k].label)
      )),
      h('div', { class: 'panel' },
        h('div', { class: 'panel-title' }, 'Agregar a ' + def.label + ' · ' + list.length + ' registros'),
        form
      ),
      h('div', { class: 'panel mt' },
        h('div', { class: 'list' }, ordered.map(({ item, index }, i) =>
          h('div', { class: 'trow' },
            h('div', { class: 'card-num' }, String(i + 1)),
            h('div', { class: 'grow' }, h('div', { class: 'trow-name', style: { whiteSpace: 'normal' } }, summary(def, item))),
            h('button', { class: 'icon-btn quiet', title: 'Editar', onclick: () => editItem(def, index, item) }, '✏️'),
            h('button', { class: 'icon-btn quiet danger', title: 'Eliminar', onclick: () => removeItem(def, index) }, '🗑️')
          )
        )),
        list.length ? null : h('div', { class: 'empty' }, 'Sin registros en esta sección.')
      ),
      h('div', { class: 'btn-row mt' },
        h('button', { class: 'btn btn-ghost', onclick: () => MCR.go('settings') }, '← Ajustes')
      )
    );

    root.append(view);
  };
})();

/* ---------- juegos propios ---------- */

(function () {
  const { h } = MCR.ui;

  MCR.screens['custom:new'] = function (root, editId) {
    root.append(MCR.topbar('catalog'));
    const view = h('div', { class: 'view' });
    const list = MCR.store.get().customGames || [];
    const existing = list.find((g) => g.id === editId) || null;

    const name = h('input', { class: 'input', placeholder: 'Nombre del juego', value: existing ? existing.name : '' });
    const sub = h('input', { class: 'input', placeholder: 'Subtítulo corto', value: existing ? existing.sub || '' : '' });
    const intro = h('textarea', { class: 'input', rows: '3', placeholder: 'Texto de portada' });
    intro.value = existing ? existing.intro || '' : '';
    const rules = h('textarea', { class: 'input', rows: '6', placeholder: 'Una regla por línea' });
    rules.value = existing ? (existing.rules || []).join('\n') : '';
    const duration = MCR.ui.durationPicker({ title: 'Temporizador', bare: true, value: existing ? existing.seconds || 0 : 0, allowOff: true, maxSeconds: 600 });

    const save = () => {
      if (!name.value.trim()) { MCR.ui.toast('Ponle nombre'); return; }
      if (duration.getValue() == null) { MCR.ui.toast('Revisa los minutos y segundos del temporizador'); return; }
      const g = {
        id: existing ? existing.id : MCR.store.uid('cg_'),
        name: name.value.trim(),
        sub: sub.value.trim(),
        intro: intro.value.trim(),
        rules: rules.value.split('\n').map((x) => x.trim()).filter(Boolean),
        seconds: duration.getValue()
      };
      const arr = MCR.store.get().customGames || [];
      const idx = arr.findIndex((x) => x.id === g.id);
      if (idx >= 0) arr[idx] = g; else arr.push(g);
      MCR.store.get().customGames = arr;
      MCR.store.save();
      MCR.ui.toast('Juego guardado');
      MCR.go('catalog');
    };

    view.append(
      h('div', { class: 'page-intro' },
        h('div', { class: 'eyebrow' }, existing ? 'Editar' : 'Nuevo'),
        h('h1', { class: 'page-h1' }, 'Juego propio')
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'grid' },
          h('div', null, h('div', { class: 'tiny', style: { marginBottom: '6px' } }, 'Nombre'), name),
          h('div', null, h('div', { class: 'tiny', style: { marginBottom: '6px' } }, 'Subtítulo'), sub),
          h('div', null, h('div', { class: 'tiny', style: { marginBottom: '6px' } }, 'Portada'), intro),
          h('div', null, h('div', { class: 'tiny', style: { marginBottom: '6px' } }, 'Reglas'), rules),
          duration
        )
      ),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-ghost', onclick: () => MCR.go('catalog') }, '← Cancelar'),
        h('button', { class: 'btn btn-gold', onclick: save }, existing ? 'Guardar cambios' : 'Crear juego')
      )
    );

    root.append(view);
  };

  MCR.screens['custom:play'] = function (root, id) {
    const g = (MCR.store.get().customGames || []).find((x) => x.id === id);
    const { root: shellRoot, body } = MCR.ui.shell({ title: g ? g.name : 'Juego', sub: g ? g.sub : '', backTo: 'catalog' });
    root.append(shellRoot);
    if (!g) { body.append(h('div', { class: 'empty' }, 'Juego no encontrado.')); return; }

    let step = 'portada';
    let ctrl = null;

    function draw() {
      if (ctrl) { ctrl.stop(); ctrl = null; }
      MCR.ui.clear(body);

      if (step === 'portada') {
        body.append(h('div', { class: 'stage' },
          h('div', { class: 'stage-label' }, 'Juego propio'),
          h('div', { class: 'stage-word sm' }, g.name),
          g.intro ? h('div', { class: 'stage-note' }, g.intro) : null,
          h('button', { class: 'btn btn-gold btn-xl', onclick: () => { step = 'reglas'; draw(); } }, 'Comenzar →')
        ));
        return;
      }

      if (step === 'reglas') {
        body.append(
          h('div', { class: 'panel' },
            h('div', { class: 'panel-title' }, 'Reglas'),
            h('div', { class: 'list' }, (g.rules || []).map((r, i) =>
              h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px' } },
                h('div', { class: 'card-num' }, String(i + 1)),
                h('div', { style: { fontSize: '15px', lineHeight: '1.45' } }, r)
              )
            )),
            (g.rules || []).length ? null : h('div', { class: 'empty' }, 'Este juego no tiene reglas escritas.')
          ),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn-ghost', onclick: () => { step = 'portada'; draw(); } }, '← Atrás'),
            g.seconds > 0 ? h('button', { class: 'btn btn-gold', onclick: () => { step = 'timer'; draw(); } }, 'Ir al temporizador →') : null
          )
        );
        return;
      }

      const ringEl = MCR.ui.ring(g.seconds);
      const playBtn = h('button', { class: 'btn btn-gold btn-xl' }, '▶ Iniciar ' + MCR.ui.fmt(g.seconds));
      playBtn.addEventListener('click', () => {
        playBtn.disabled = true;
        playBtn.textContent = '⏱ Corriendo…';
        ctrl = MCR.ui.countdown(g.seconds, (rem) => ringEl.set(rem, g.seconds), () => {
          playBtn.textContent = '¡Tiempo!';
        });
      });
      body.append(h('div', { class: 'stage' }, ringEl, playBtn));
    }

    draw();
  };
})();

/* ---------- arranque ---------- */

MCR.store.load();
MCR.go('home');
