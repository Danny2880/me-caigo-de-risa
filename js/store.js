window.MCR = window.MCR || {};

/* =========================================================
   Estado + persistencia local
   ========================================================= */

MCR.store = (function () {
  const KEY = 'mcr:state:v1';

  let state = null;
  let saveTimer = null;

  const clone = (x) => JSON.parse(JSON.stringify(x));

  function uid(prefix) {
    const rnd = Math.random().toString(36).slice(2, 8);
    return prefix + rnd + Date.now().toString(36).slice(-4);
  }

  function mergedCategories() {
    const d = MCR.data;
    const out = [];
    const seen = new Set();
    [...(d.categories || []), ...(d.auction || [])].forEach((c) => {
      const name = String(c.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ id: c.id || uid('ct_'), name });
    });
    return out;
  }

  function fresh() {
    const d = MCR.data;
    return {
      version: 1,
      players: d.seedPlayers.map((name) => ({ id: uid('pl_'), name })),
      events: [],
      teams: [],
      used: { movies: [], letterPairs: [], categories: [], auction: [] },
      content: {
        movies: clone(d.movies),
        lipWords: clone(d.lipWords),
        syllablesIni: clone(d.syllablesIni),
        syllablesFin: clone(d.syllablesFin),
        letterPairs: clone(d.letterPairs),
        categories: mergedCategories(),
        auction: []
      },
      customGames: [],
      settings: { lastGame: null, theme: 'light' }
    };
  }

  /* Une la antigua lista de subasta con las categorías y conserva el historial de uso. */
  function migrateContent(st) {
    const content = st.content || (st.content = {});
    content.categories = content.categories || [];
    content.auction = content.auction || [];
    st.settings = st.settings || {};
    if (!st.settings.funCategoriesV1) {
      MCR.data.categories.filter((c) => /^cg(2[5-9]|3[0-9]|40)$/.test(c.id)).forEach((c) => {
        if (!content.categories.some((item) => item.id === c.id || item.name.trim().toLowerCase() === c.name.toLowerCase())) {
          content.categories.push(clone(c));
        }
      });
      st.settings.funCategoriesV1 = true;
      save();
    }
    /* Contenido agregado en diseño v2.2, sin reemplazar personalizaciones existentes. */
    if (!st.settings.contentV2) {
      const categoryNames = new Set(content.categories.map((c) => String(c.name || '').trim().toLowerCase()));
      MCR.data.categories.filter((c) => /^cg(4[1-9]|5[0-9]|6[0-4])$/.test(c.id)).forEach((c) => {
        const key = c.name.trim().toLowerCase();
        if (!categoryNames.has(key)) {
          content.categories.push(clone(c));
          categoryNames.add(key);
        }
      });

      content.lipWords = content.lipWords || [];
      const lipWords = new Set(content.lipWords.map((word) => String(word).trim().toLowerCase()));
      MCR.data.lipWords.forEach((word) => {
        const key = word.trim().toLowerCase();
        if (!lipWords.has(key)) {
          content.lipWords.push(word);
          lipWords.add(key);
        }
      });

      /* Las películas se manejan únicamente por título. */
      (content.movies || []).forEach((movie) => { delete movie.mime; });
      st.settings.contentV2 = true;
      save();
    }
    /* El catálogo v3 reemplaza por completo las categorías anteriores. */
    if (!st.settings.categoryCatalogV3) {
      content.categories = clone(MCR.data.categories);
      content.auction = [];
      st.used = st.used || {};
      st.used.categories = (st.used.categories || []).filter((id) =>
        content.categories.some((category) => category.id === id)
      );
      st.used.auction = [];
      st.settings.categoryCatalogV3 = true;
      save();
    }
    if (!content.auction.length && !(st.used && st.used.auction || []).length) return;

    const byName = new Map();
    content.categories.forEach((c) => byName.set(String(c.name || '').trim().toLowerCase(), c));
    const idMap = {};

    content.auction.forEach((a) => {
      const name = String(a.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      let target = byName.get(key);
      if (!target) {
        target = { id: a.id || uid('ct_'), name };
        content.categories.push(target);
        byName.set(key, target);
      }
      idMap[a.id] = target.id;
    });

    st.used = st.used || {};
    st.used.categories = st.used.categories || [];
    (st.used.auction || []).forEach((id) => {
      const mapped = idMap[id] || id;
      if (!st.used.categories.includes(mapped)) st.used.categories.push(mapped);
    });
    st.used.auction = [];
    content.auction = [];
    save();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) state = parsed;
      }
    } catch (e) {
      console.warn('No se pudo leer el estado guardado', e);
    }
    if (!state) state = fresh();
    // rellenar huecos de versiones anteriores
    state.customGames = state.customGames || [];
    state.teams = state.teams || [];
    state.settings = state.settings || {};
    if (!['light', 'dark'].includes(state.settings.theme)) state.settings.theme = 'light';
    state.used = state.used || { movies: [], letterPairs: [], categories: [], auction: [] };
    migrateContent(state);
    migrateRoster(state);
    addLatePlayers(state);
    return state;
  }

  /* Lista de asistentes de nov 2026: renombra a quien ya existía (por nombre o alias),
     añade a los nuevos y marca como ausentes a los demás. No borra a nadie: los
     ausentes se reactivan con un toque en Jugadores. Corre una sola vez. */
  function migrateRoster(st) {
    if (st.settings.rosterNov2026) return;
    const d = MCR.data;
    const aliases = d.playerAliases || {};
    const keep = new Set();
    d.seedPlayers.forEach((name) => {
      const keys = [name, ...(aliases[name] || [])].map(normName);
      const p = st.players.find((x) => !keep.has(x.id) && normName(x.name) === keys[0]) ||
        st.players.find((x) => !keep.has(x.id) && keys.includes(normName(x.name)));
      if (p) {
        p.name = name;
        delete p.absent;
        delete p.archived;
        keep.add(p.id);
      } else {
        const np = { id: uid('pl_'), name };
        st.players.push(np);
        keep.add(np.id);
      }
    });
    st.players.forEach((p) => { if (!keep.has(p.id) && !p.archived) p.absent = true; });
    st.settings.rosterNov2026 = true;
    save();
  }

  /* Personas que se suman a la lista después de la migración de nov 2026.
     Se añaden (o se reactivan) una sola vez, sin tocar a nadie más. */
  function addLatePlayers(st) {
    const late = ['Rebeca'];
    st.settings.latePlayersAdded = st.settings.latePlayersAdded || [];
    late.forEach((name) => {
      if (st.settings.latePlayersAdded.includes(name)) return;
      const p = st.players.find((x) => normName(x.name) === normName(name));
      if (p) { delete p.absent; delete p.archived; }
      else st.players.push({ id: uid('pl_'), name });
      st.settings.latePlayersAdded.push(name);
    });
    save();
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 120);
  }

  function flush() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('No se pudo guardar', e);
    }
  }

  /* ---------- jugadores ----------
     Cada jugador tiene tres estados posibles:
       · presente  → aparece en todos los selectores y sugerencias de los juegos.
       · ausente   (absent: true)   → sigue en la lista de Jugadores, pero los juegos
                                       no lo ofrecen. Sirve para quien no llegó, salió
                                       un rato o ya se fue. Se reactiva con un toque.
       · archivado (archived: true) → «eliminado» de la lista. Si ya tenía partidas, el
                                       registro se conserva para que el historial siga
                                       mostrando su nombre en lugar de «—».
     players() devuelve solo a los presentes: es lo que deben usar los juegos.
     roster() devuelve presentes y ausentes: es lo que muestra la pantalla Jugadores. */

  function normName(name) {
    return String(name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  }

  function players() { return state.players.filter((p) => !p.archived && !p.absent); }
  function roster() { return state.players.filter((p) => !p.archived); }

  /* Añadir es idempotente por nombre: si «Ana» ya existe (aunque esté ausente o
     archivada) se reactiva en vez de crear un duplicado que partiría sus estadísticas. */
  function addPlayer(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return null;
    const existing = state.players.find((p) => normName(p.name) === normName(clean));
    if (existing) {
      const wasAway = !!(existing.absent || existing.archived);
      delete existing.absent;
      delete existing.archived;
      save();
      // Copia con banderas informativas: no se guardan en el estado.
      return Object.assign({}, existing, { reused: true, wasAway });
    }
    const p = { id: uid('pl_'), name: clean };
    state.players.push(p);
    save();
    return p;
  }

  /* Devuelve false si el nombre nuevo ya lo usa otra persona (evita homónimos confusos). */
  function renamePlayer(id, name) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return false;
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return false;
    const clash = state.players.find((x) => x.id !== id && !x.archived && normName(x.name) === normName(clean));
    if (clash) return false;
    p.name = clean;
    save();
    return true;
  }

  function setPresent(id, present) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;
    if (present) delete p.absent; else p.absent = true;
    save();
  }

  /* Sin historial se borra de verdad; con historial solo se archiva. */
  function removePlayer(id) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;
    const hasHistory = state.events.some((ev) => (ev.players || []).includes(id) || (ev.winners || []).includes(id));
    if (hasHistory) {
      p.archived = true;
      delete p.absent;
    } else {
      state.players = state.players.filter((x) => x.id !== id);
    }
    save();
  }

  function byId(id) {
    return state.players.find((x) => x.id === id) || null;
  }

  function nameOf(id) {
    const p = byId(id);
    return p ? p.name : '—';
  }

  /* ---------- eventos (historial) ---------- */

  function recordEvent({ gameId, playerIds, winners, meta }) {
    const ev = {
      id: uid('ev_'),
      gameId,
      at: Date.now(),
      players: (playerIds || []).slice(),
      winners: (winners || []).slice(),
      meta: meta || {}
    };
    state.events.push(ev);
    state.settings.lastGame = gameId;
    save();
    return ev;
  }

  function eventsFor(gameId) {
    return state.events.filter((e) => e.gameId === gameId);
  }

  /* Corregir un registro equivocado: se elimina la partida completa y las estadísticas
     se recalculan solas, porque stats() siempre se deriva de state.events. */
  function removeEvent(id) {
    const before = state.events.length;
    state.events = state.events.filter((e) => e.id !== id);
    if (state.events.length !== before) save();
    return state.events.length !== before;
  }

  function stats() {
    const map = {};
    state.players.forEach((p) => {
      map[p.id] = { plays: 0, wins: 0, last: 0, byGame: {} };
    });
    state.events.forEach((ev) => {
      (ev.players || []).forEach((id) => {
        if (!map[id]) return;
        map[id].plays += 1;
        map[id].byGame[ev.gameId] = (map[id].byGame[ev.gameId] || 0) + 1;
        if (ev.at > map[id].last) map[id].last = ev.at;
      });
      (ev.winners || []).forEach((id) => {
        if (map[id]) map[id].wins += 1;
      });
    });
    return map;
  }

  /* Rotación justa. Ordena a los presentes por prioridad para jugar:
       1. Menos partidas en total      → nadie se queda fuera toda la fiesta.
       2. Menos veces en ESTE juego    → a igualdad, se reparte cada juego entre más gente.
       3. Jugó hace más tiempo         → quien acaba de jugar descansa un turno.
       4. Empate                       → al azar (nunca por orden alfabético).
     Los juegos de equipo suman 1 partida a todos los que participan, así que no
     alteran el orden relativo; quien llega tarde o estuvo ausente queda con menos
     partidas y, por lo tanto, sube de prioridad automáticamente. */
  function recommend(n, opts) {
    opts = opts || {};
    const exclude = new Set(opts.exclude || []);
    const gameId = opts.gameId || null;
    const st = stats();
    const pool = shuffle(players())
      .filter((p) => !exclude.has(p.id))
      .map((p) => ({ p, s: st[p.id] || { plays: 0, last: 0, byGame: {} } }))
      .sort((a, b) => {
        if (a.s.plays !== b.s.plays) return a.s.plays - b.s.plays;
        if (gameId) {
          const ga = (a.s.byGame || {})[gameId] || 0;
          const gb = (b.s.byGame || {})[gameId] || 0;
          if (ga !== gb) return ga - gb;
        }
        if (a.s.last !== b.s.last) return a.s.last - b.s.last;
        return 0;
      })
      .map((x) => x.p.id);
    return pool.slice(0, n);
  }

  /* Sugerencia nueva: prioriza menos partidas y evita repetir la selección actual. */
  function recommendFresh(n, current, opts) {
    opts = opts || {};
    const blocked = new Set(opts.exclude || []);
    const selected = Array.from(new Set(current || [])).filter((id) => !blocked.has(id) && byId(id));
    const excluded = Array.from(new Set([].concat(opts.exclude || [], selected)));
    const fresh = recommend(n, { gameId: opts.gameId, exclude: excluded });
    if (fresh.length >= n) return fresh;

    /* Si ya no hay suficientes alternativas, conserva la mayor variedad posible. */
    const fill = recommend(n - fresh.length, { gameId: opts.gameId, exclude: [].concat(opts.exclude || [], fresh) });
    return fresh.concat(fill).slice(0, n);
  }

  function rank() {
    const st = stats();
    return roster()
      .map((p) => ({ ...p, ...(st[p.id] || { plays: 0, wins: 0, last: 0, byGame: {} }) }))
      .sort((a, b) => {
        if (a.plays !== b.plays) return a.plays - b.plays;
        if (a.last !== b.last) return a.last - b.last;
        return a.name.localeCompare(b.name, 'es');
      });
  }

  /* ---------- equipos ---------- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  function previousPairs() {
    const set = new Set();
    state.teams.forEach((t) => {
      (t.teams || []).forEach((team) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            set.add(pairKey(team[i], team[j]));
          }
        }
      });
    });
    return set;
  }

  /* Reparte en k equipos parejos intentando no repetir compañeros.
     · Tamaños: se reparte en orden circular (i % k), así que la diferencia entre
       equipos nunca pasa de 1. Con números impares, el equipo que queda con una
       persona extra se decide al azar en cada mezcla.
     · Variedad: prueba hasta 400 mezclas y se queda con la que repite menos parejas
       de compañeros respecto a juegos anteriores (state.teams). */
  function makeTeams(ids, k) {
    k = k || 2;
    const prev = previousPairs();
    let best = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 400; attempt++) {
      const arr = shuffle(ids);
      const teams = Array.from({ length: k }, () => []);
      arr.forEach((id, i) => teams[i % k].push(id));
      let score = 0;
      teams.forEach((team) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            if (prev.has(pairKey(team[i], team[j]))) score++;
          }
        }
      });
      if (score < bestScore) {
        bestScore = score;
        best = teams;
        if (score === 0) break;
      }
    }
    return best;
  }

  function rememberTeams(gameId, teams) {
    state.teams.push({ id: uid('tm_'), gameId, at: Date.now(), teams: clone(teams) });
    if (state.teams.length > 40) state.teams = state.teams.slice(-40);
    save();
  }

  /* ---------- contenido usado ---------- */

  function used(key) { return state.used[key] || []; }

  function markUsed(key, id) {
    if (!state.used[key]) state.used[key] = [];
    if (!state.used[key].includes(id)) state.used[key].push(id);
    save();
  }

  function resetUsed(key) {
    if (key === 'auction') key = 'categories';
    if (key) state.used[key] = [];
    else state.used = { movies: [], letterPairs: [], categories: [], auction: [] };
    save();
  }

  /* ---------- copias de seguridad ---------- */

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 1) throw new Error('Archivo no válido');
    state = parsed;
    migrateContent(state);
    flush();
  }

  function resetAll() {
    state = fresh();
    flush();
    live.clearAll();
  }

  /* ---------- partida en curso ----------
     Guarda una foto del estado de cada juego en cada pantalla. Si la tablet recarga
     la página, se sale del juego por accidente o se interrumpe la dinámica, al volver
     a entrar se ofrece continuar donde se quedó. Vive en una llave aparte para no
     mezclarse con el respaldo ni con el historial definitivo. */
  const LIVE_KEY = 'mcr:live:v1';
  const live = {
    all() {
      try { return JSON.parse(localStorage.getItem(LIVE_KEY) || '{}') || {}; } catch (e) { return {}; }
    },
    write(map) {
      try { localStorage.setItem(LIVE_KEY, JSON.stringify(map)); } catch (e) { /* sin espacio: no es crítico */ }
    },
    save(route, snapshot) {
      const map = live.all();
      map[route] = { at: Date.now(), state: snapshot };
      live.write(map);
    },
    load(route) { return live.all()[route] || null; },
    clear(route) {
      const map = live.all();
      if (!(route in map)) return;
      delete map[route];
      live.write(map);
    },
    clearAll() { live.write({}); }
  };

  return {
    load, save, flush,
    get: () => state,
    players, roster, addPlayer, renamePlayer, removePlayer, setPresent, byId, nameOf,
    recordEvent, removeEvent, eventsFor, stats, recommend, recommendFresh, rank,
    live,
    makeTeams, rememberTeams, shuffle, pairKey,
    used, markUsed, resetUsed,
    exportJSON, importJSON, resetAll,
    uid
  };
})();
