window.MCR = window.MCR || {};

/* =========================================================
   Utilidades de interfaz
   ========================================================= */

MCR.ui = (function () {

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? m + ':' + String(r).padStart(2, '0') : String(r);
  }

  function durationText(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return [minutes ? minutes + ' min' : '', rest ? rest + ' s' : ''].filter(Boolean).join(' ') || '0 s';
  }

  let durationId = 0;
  function durationPicker(opts) {
    opts = opts || {};
    const min = opts.minSeconds == null ? 1 : opts.minSeconds;
    const max = opts.maxSeconds == null ? 5999 : opts.maxSeconds;
    const allowOff = !!opts.allowOff;
    let value = opts.value == null ? 60 : opts.value;
    let valid = true;
    const id = 'duration-' + (++durationId);
    const inputProps = { class: 'input', type: 'number', step: '1', inputmode: 'numeric', 'aria-describedby': id + '-status' };
    const minutes = h('input', { ...inputProps, min: '0', max: String(Math.floor(max / 60)), value: String(Math.floor(value / 60)), 'aria-label': 'Minutos', oninput: readCustom });
    const seconds = h('input', { ...inputProps, min: '0', max: '59', value: String(value % 60), 'aria-label': 'Segundos', oninput: readCustom });
    const status = h('p', { id: id + '-status', class: 'duration-status', 'aria-live': 'polite' });
    const choices = (opts.presets || [30, 60, 90, 120]).filter((n) => n >= min && n <= max);
    if (allowOff) choices.unshift(0);
    const buttons = choices.map((n) => h('button', {
      type: 'button', class: 'btn btn-ghost', 'data-duration': String(n),
      onclick: () => { minutes.value = String(Math.floor(n / 60)); seconds.value = String(n % 60); readCustom(); }
    }, n === 0 ? 'Sin temporizador' : durationText(n)));
    const root = h('section', { class: (opts.bare ? '' : 'panel ') + 'duration-picker', 'aria-label': opts.title || 'Duración' },
      h('h3', { class: 'panel-title' }, opts.title || 'Duración'),
      h('div', { class: 'duration-presets', role: 'group', 'aria-label': 'Duraciones preconfiguradas' }, buttons),
      h('fieldset', { class: 'duration-custom' },
        h('legend', null, 'Tiempo personalizado'),
        h('label', { class: 'duration-field' }, h('span', null, 'Minutos'), minutes),
        h('span', { class: 'duration-separator', 'aria-hidden': 'true' }, ':'),
        h('label', { class: 'duration-field' }, h('span', null, 'Segundos'), seconds)
      ),
      status,
      h('p', { class: 'duration-help' }, 'De ' + durationText(min) + ' a ' + durationText(max) + (allowOff ? '. También puedes dejarlo sin temporizador.' : '.'))
    );

    function paint() {
      root.dataset.valid = String(valid);
      root.dataset.seconds = String(value);
      buttons.forEach((button) => {
        const selected = valid && Number(button.dataset.duration) === value;
        // Opción elegida = estado, no acción: tono suave, el violeta sólido queda para «Continuar».
        button.classList.toggle('opt-on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      minutes.setAttribute('aria-invalid', String(!valid));
      seconds.setAttribute('aria-invalid', String(!valid));
      status.textContent = valid ? (value === 0 ? 'Sin temporizador' : 'Duración elegida: ' + durationText(value)) : 'Introduce minutos y segundos enteros (segundos de 0 a 59). El total debe estar entre ' + durationText(min) + ' y ' + durationText(max) + '.';
    }

    function readCustom() {
      const m = Number(minutes.value);
      const s = Number(seconds.value);
      const total = m * 60 + s;
      valid = /^\d+$/.test(minutes.value) && /^\d+$/.test(seconds.value) && Number.isSafeInteger(total) && m >= 0 && s >= 0 && s <= 59 && ((allowOff && total === 0) || (total >= min && total <= max));
      if (valid) { value = total; if (opts.onChange) opts.onChange(total); }
      paint();
      if (opts.onValidityChange) opts.onValidityChange(valid);
    }

    root.getValue = () => valid ? value : null;
    paint();
    return root;
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function avatar(name) {
    return h('div', { class: 'avatar' }, initials(name));
  }

  /* ---------- toast ---------- */

  /* Aviso breve. Con opts.action ({ label, onClick }) muestra un botón (p. ej. «Deshacer»)
     y permanece más tiempo para dar oportunidad de corregir un toque equivocado. */
  let toastTimers = [];
  function toast(msg, opts) {
    opts = opts || {};
    const layer = document.getElementById('layer');
    let wrap = layer.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
      layer.append(wrap);
    }
    /* Un solo aviso a la vez: no tapa la pantalla si se mueven varias personas seguidas. */
    toastTimers.forEach(clearTimeout);
    toastTimers = [];
    clear(wrap);
    const foot = document.querySelector('.game-foot');
    wrap.style.bottom = foot && foot.children.length ? (foot.offsetHeight + 12) + 'px' : '';
    const t = h('div', { class: 'toast' + (opts.action ? ' has-action' : '') },
      h('span', null, msg),
      opts.action ? h('button', {
        class: 'toast-action',
        onclick: () => { t.remove(); opts.action.onClick(); }
      }, opts.action.label) : null
    );
    wrap.append(t);
    const life = opts.action ? 6000 : 2200;
    toastTimers.push(setTimeout(() => { t.classList.add('leaving'); }, life - 300));
    toastTimers.push(setTimeout(() => t.remove(), life));
  }

  /* ---------- diálogo ---------- */

  function dialog(opts) {
    return new Promise((resolve) => {
      const layer = document.getElementById('layer');
      layer.classList.add('on');

      const close = (val) => {
        scrim.remove();
        if (!layer.querySelector('.scrim')) layer.classList.remove('on');
        resolve(val);
      };

      const actions = (opts.actions || [{ label: 'Entendido', value: true }]).map((a) =>
        h('button', {
          class: 'btn ' + (a.kind === 'danger' ? 'btn-danger' : a.kind === 'ok' ? 'btn-ok' : a.kind === 'ghost' ? 'btn-ghost' : 'btn-gold'),
          onclick: () => close(a.value)
        }, a.label)
      );

      const box = h('div', { class: 'modal' },
        opts.title ? h('h3', null, opts.title) : null,
        opts.message ? h('p', null, opts.message) : null,
        opts.body || null,
        h('div', { class: 'btn-row' }, actions)
      );

      const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(null); } }, box);
      layer.append(scrim);
    });
  }

  function confirm(title, message, confirmLabel, danger) {
    return dialog({
      title,
      message,
      actions: [
        { label: 'Cancelar', value: false, kind: 'ghost' },
        { label: confirmLabel || 'Sí, continuar', value: true, kind: danger ? 'danger' : 'gold' }
      ]
    });
  }

  /* ---------- revelar en grande ----------
     Pantalla completa para mostrar algo secreto a una sola persona (la película del
     Teléfono). Se cierra tocando en cualquier lugar, con la × o con Esc. */
  function reveal(opts) {
    const layer = document.getElementById('layer');
    layer.classList.add('on');
    const close = () => {
      document.removeEventListener('keydown', onKey);
      scrim.remove();
      if (!layer.querySelector('.scrim')) layer.classList.remove('on');
      if (opts.onClose) opts.onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } };
    const scrim = h('div', { class: 'scrim reveal-scrim', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.kicker || 'Revelar', onclick: close },
      h('button', { class: 'reveal-x', 'aria-label': 'Ocultar' }, '×'),
      h('div', { class: 'reveal-box' },
        opts.kicker ? h('div', { class: 'reveal-kicker' }, opts.kicker) : null,
        h('div', { class: 'reveal-title' }, opts.title),
        opts.note ? h('div', { class: 'reveal-note' }, opts.note) : null,
        h('div', { class: 'reveal-hint' }, 'Toca en cualquier lugar para ocultar')
      )
    );
    layer.append(scrim);
    document.addEventListener('keydown', onKey);
    setTimeout(() => scrim.querySelector('.reveal-x').focus(), 0);
  }

  /* ---------- elegir a una persona y confirmar ----------
     Tocar solo marca (✓). Nada avanza hasta tocar el botón de confirmar que cada
     pantalla pone en el pie: así un toque accidental nunca elimina ni cambia a nadie. */
  function choiceGrid(opts) {
    return h('div', { class: 'opt-grid choice-grid', role: 'radiogroup', 'aria-label': opts.label || 'Elige a una persona' },
      opts.ids.map((id) => {
        const on = opts.value === id;
        return h('button', {
          class: 'opt opt-big' + (on ? ' sel' : ''),
          role: 'radio',
          'aria-checked': String(on),
          'data-focus-key': 'choice-' + (opts.key || '') + id,
          onclick: () => opts.onSelect(on && opts.toggle !== false ? null : id)
        }, on ? '✓ ' + MCR.store.nameOf(id) : MCR.store.nameOf(id));
      })
    );
  }

  /* Botón principal de confirmación: deshabilitado hasta que haya alguien marcado. */
  function confirmBtn(id, label, onConfirm, opts) {
    opts = opts || {};
    return h('button', {
      class: 'btn ' + (opts.kind || 'btn-gold') + ' btn-xl confirm-btn',
      disabled: !id,
      'data-focus-key': 'confirm-' + (opts.key || ''),
      onclick: () => { if (id) onConfirm(id); }
    }, id ? label(MCR.store.nameOf(id)) : (opts.empty || 'Elige a alguien'));
  }

  /* ---------- cambio de jugador ----------
     «🔄 Cambio»: alguien sale a media partida y otra persona toma su lugar exacto
     (equipo, turno, pareja, fila). Se reemplaza el id en el estado del juego salvo en
     el historial ya jugado, así lo registrado no cambia de dueño. */
  const SWAP_KEEP = ['history', 'results', 'rounds', 'log', 'eliminated', 'saved', 'losses', 'swappedOut'];

  /* Participantes de la partida para el registro: los que terminaron + quienes
     salieron con 🔄 Cambio (sí jugaron una parte). Vacía la lista para la siguiente. */
  function withSwapped(S, ids) {
    const all = Array.from(new Set([].concat(ids || [], S.swappedOut || []).filter(Boolean)));
    S.swappedOut = [];
    return all;
  }

  function idsIn(obj, out, skip) {
    out = out || new Set();
    if (typeof obj === 'string') { if (/^pl_/.test(obj)) out.add(obj); return out; }
    if (Array.isArray(obj)) { obj.forEach((v) => idsIn(v, out, skip)); return out; }
    if (obj && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype) {
      Object.keys(obj).forEach((k) => { if (k !== 'ctrl' && !(skip || []).includes(k)) idsIn(obj[k], out, skip); });
    }
    return out;
  }

  function replaceId(obj, from, to) {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] === from) obj[i] = to; else replaceId(obj[i], from, to);
      }
      if (obj.every((v) => typeof v === 'string')) {
        const seen = new Set();
        for (let i = 0; i < obj.length; i++) { if (seen.has(obj[i])) obj.splice(i--, 1); else seen.add(obj[i]); }
      }
      return;
    }
    if (obj && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype) {
      Object.keys(obj).forEach((k) => {
        if (k === 'ctrl' || SWAP_KEEP.includes(k)) return;
        if (obj[k] === from) obj[k] = to; else replaceId(obj[k], from, to);
      });
    }
  }

  function swapPlayer(opts) {
    const ids = opts.ids().filter((id) => MCR.store.byId(id));
    if (!ids.length) return;
    const layer = document.getElementById('layer');
    layer.classList.add('on');
    let outId = ids.length === 1 ? ids[0] : null;
    let outConfirmed = ids.length === 1;
    let inId = null;
    let extra = [];   // personas añadidas desde el buscador en este cambio
    const close = () => {
      document.removeEventListener('keydown', onKey);
      scrim.remove();
      if (!layer.querySelector('.scrim')) layer.classList.remove('on');
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const apply = (inId) => {
      const outName = MCR.store.nameOf(outId);
      replaceId(opts.S, outId, inId);
      opts.S.swappedOut = (opts.S.swappedOut || []).filter((x) => x !== inId);
      if (!opts.S.swappedOut.includes(outId)) opts.S.swappedOut.push(outId);
      close();
      if (opts.onSwap) opts.onSwap(outId, inId);
      MCR.go(opts.route);
      toast('🔄 ' + MCR.store.nameOf(inId) + ' entra por ' + outName);
    };
    const box = h('div', { class: 'modal swap-modal' });
    const paint = () => {
      clear(box);
      box.append(h('button', { class: 'icon-btn quiet modal-x', 'aria-label': 'Cerrar', onclick: close }, '×'));
      if (!outConfirmed) {
        box.append(
          h('h3', null, '🔄 Cambio · ¿quién sale?'),
          h('p', null, 'Toca a quien sale y luego «Siguiente». Quien entre toma su lugar exacto: equipo, turno y papel. Lo que ya se jugó no cambia.'),
          h('div', { class: 'swap-out', role: 'radiogroup' }, ids.map((id) =>
            h('button', {
              class: 'btn btn-ghost swap-chip' + (outId === id ? ' sel' : ''),
              role: 'radio', 'aria-checked': String(outId === id),
              onclick: () => { outId = outId === id ? null : id; paint(); }
            }, (outId === id ? '✓ ' : '') + MCR.store.nameOf(id))
          )),
          h('div', { class: 'btn-row swap-actions' },
            h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancelar'),
            confirmBtn(outId, (n) => 'Siguiente · sale ' + n + ' →', () => { outConfirmed = true; inId = null; paint(); })
          )
        );
        return;
      }
      const busy = idsIn(opts.S, null, SWAP_KEEP.concat('picks')); // quien descansa sí puede entrar
      const pool = MCR.store.players().map((p) => p.id).filter((id) => !busy.has(id) || extra.includes(id));
      box.append(
        h('h3', null, '¿Quién entra por ' + MCR.store.nameOf(outId) + '?'),
        peoplePicker({
          mode: 'single',
          key: 'swap-' + opts.route,
          gameId: opts.gameId,
          ids: pool,
          selected: inId ? [inId] : [],
          title: 'Disponibles',
          onPick: (id) => { inId = inId === id ? null : id; paint(); },
          onAdd: (p) => {
            if (busy.has(p.id) && !extra.includes(p.id)) { toast(p.name + ' ya está en esta partida'); return; }
            extra.push(p.id); inId = p.id; paint();
          },
          emptyText: 'No hay nadie libre. Escribe un nombre si llegó alguien.'
        }),
        h('div', { class: 'btn-row swap-actions' },
          ids.length > 1
            ? h('button', { class: 'btn btn-ghost', onclick: () => { outConfirmed = false; inId = null; paint(); } }, '← Atrás')
            : h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancelar'),
          confirmBtn(inId, (n) => '✓ Confirmar · entra ' + n, apply)
        )
      );
    };
    paint();
    const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } }, box);
    layer.append(scrim);
    document.addEventListener('keydown', onKey);
  }

  /* ---------- anillo de tiempo ---------- */

  function ring(seconds) {
    const el = h('div', { class: 'ring' });
    el.innerHTML =
      '<svg viewBox="0 0 120 120">' +
      '<circle class="ring-bg" cx="60" cy="60" r="52"></circle>' +
      '<circle class="ring-fg" cx="60" cy="60" r="52"></circle>' +
      '</svg>' +
      '<div class="ring-num">' + fmt(seconds) + '</div>';
    const fg = el.querySelector('.ring-fg');
    const num = el.querySelector('.ring-num');
    const C = 2 * Math.PI * 52;
    fg.style.strokeDasharray = String(C);

    el.set = (remaining, total) => {
      const p = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
      fg.style.strokeDashoffset = String(C * (1 - p));
      num.textContent = fmt(remaining);
      el.classList.toggle('warn', remaining <= 5.05 && remaining > 0);
    };
    el.set(seconds, seconds);
    return el;
  }

  /* Cronómetro con requestAnimationFrame */
  function countdown(seconds, onTick, onEnd) {
    const end = performance.now() + seconds * 1000;
    let stopped = false;
    let raf = null;

    function loop() {
      if (stopped) return;
      const rem = (end - performance.now()) / 1000;
      if (rem <= 0) {
        stopped = true;
        onTick && onTick(0);
        onEnd && onEnd();
        return;
      }
      onTick && onTick(rem);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return {
      stop() { stopped = true; if (raf) cancelAnimationFrame(raf); },
      get remaining() { return Math.max(0, (end - performance.now()) / 1000); }
    };
  }

  /* ---------- temporizador compartido ----------
     Todos los juegos con reloj usan el mismo objeto de estado:
       { total, remaining, status }   status: 'idle' | 'running' | 'paused' | 'done'
     Se guarda dentro del estado del juego (S), así que sobrevive a cada re-render
     (MCR.go reconstruye la pantalla) y a la restauración de una partida en curso:
     al restaurar, un reloj que corría queda en pausa para que nadie pierda tiempo.
     El control activo (S.ctrl) se detiene siempre al salir del juego (disposeGame). */
  function newTimer(total) {
    return { total, remaining: total, status: 'idle' };
  }

  function timerView(S, t, opts) {
    opts = opts || {};
    const route = opts.route;
    const ringEl = ring(t.remaining);
    ringEl.set(t.remaining, t.total);
    ringEl.classList.toggle('paused', t.status === 'paused');
    if (S.ctrl) { S.ctrl.stop(); S.ctrl = null; }

    if (t.status === 'running') {
      S.ctrl = countdown(t.remaining,
        (rem) => { t.remaining = rem; ringEl.set(rem, t.total); },
        () => {
          t.remaining = 0;
          t.status = 'done';
          S.ctrl = null;
          if (!ringEl.isConnected) return;
          if (opts.onEnd) opts.onEnd(); else MCR.go(route);
        });
    }

    const go = (status, remaining) => {
      if (S.ctrl) { S.ctrl.stop(); S.ctrl = null; }
      t.status = status;
      if (remaining != null) t.remaining = remaining;
      MCR.go(route);
    };

    const startLabel = opts.startLabel || ('▶ Iniciar ' + fmt(t.total));
    const buttons = [];
    if (t.status === 'idle') {
      buttons.push(h('button', { class: 'btn btn-gold btn-xl timer-main', onclick: () => go('running') }, startLabel));
    } else if (t.status === 'running') {
      buttons.push(h('button', { class: 'btn btn-ghost timer-main', onclick: () => go('paused') }, '⏸ Pausar'));
    } else if (t.status === 'paused') {
      buttons.push(h('button', { class: 'btn btn-gold btn-xl timer-main', onclick: () => go('running') }, '▶ Reanudar'));
    }
    if (t.status !== 'idle' && opts.allowRestart !== false) {
      buttons.push(h('button', {
        class: 'btn btn-ghost timer-restart',
        title: 'Vuelve el reloj a ' + fmt(t.total) + ' sin cambiar nada más',
        onclick: () => go('idle', t.total)
      }, '↺ Reiniciar reloj'));
    }
    const controls = h('div', { class: 'timer-controls' + (t.status === 'paused' ? ' paused' : '') },
      t.status === 'paused' ? h('span', { class: 'timer-paused-label' }, 'En pausa') : null,
      buttons
    );
    return { ring: ringEl, controls };
  }

  /* ---------- shell de juego ----------
     Dentro de un juego no se muestra la navegación general: evita salir por accidente
     y libera espacio en la tablet. La «×» siempre es segura porque la partida en curso
     queda guardada (MCR.store.live) y se ofrece continuarla al volver. */
  let visualMode = false;

  /* ---------- efectos de sonido ----------
     Error: sounds/error.wav (buzzer sin el silencio inicial). Correcto: campanita generada con Web Audio,
     así no depende de ningún archivo. Se usan en Caricaturas (botón «✕ ¡Error!»),
     Te la compro (veredicto) y Teléfono (respuesta final). */
  const sfx = (() => {
    let ctx = null;
    let errAudio = null;
    function audioCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, start, dur, type, vol) {
      const c = audioCtx();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const t = c.currentTime + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    function ok() {
      tone(880, 0, 0.18, 'triangle', 0.4);
      tone(1318.5, 0.12, 0.45, 'triangle', 0.4);
    }
    /* El buzzer se descarga y decodifica una sola vez (al primer toque en la
       pantalla) y se toca desde memoria con Web Audio: suena al instante. */
    let errBuffer = null;
    let errLoading = null;
    function loadError() {
      const c = audioCtx();
      if (!c || errBuffer || errLoading) return errLoading;
      errLoading = fetch('sounds/error.wav')
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, fail) => c.decodeAudioData(data, ok, fail)))
        .then((buf) => { errBuffer = buf; })
        .catch(() => { errLoading = null; });
      return errLoading;
    }
    function playBuffer() {
      const c = audioCtx();
      const src = c.createBufferSource();
      src.buffer = errBuffer;
      src.connect(c.destination);
      src.start(0);
    }
    function error() {
      try {
        if (errBuffer) return playBuffer();
        if (!errAudio) errAudio = new Audio('sounds/error.wav');
        errAudio.currentTime = 0;
        const p = errAudio.play();
        if (p && p.catch) p.catch(() => { tone(140, 0, 0.6, 'sawtooth', 0.3); });
        loadError();
      } catch (e) {
        tone(140, 0, 0.6, 'sawtooth', 0.3);
      }
    }
    /* Precarga en el primer toque (los navegadores no dejan crear audio antes). */
    document.addEventListener('pointerdown', function warm() {
      document.removeEventListener('pointerdown', warm, true);
      loadError();
    }, true);
    /* Botón grande de error para el momento en que alguien se equivoca. */
    function errorButton() {
      return h('button', { class: 'btn btn-danger btn-xl sfx-error-btn', title: 'Suena el sonido de error', onclick: error }, '✕ ¡Error!');
    }
    return { ok, error, errorButton };
  })();

  /* Frase pirata para quien pierde: «¡X tendrá que caminar por la plancha!».
     names = texto o lista de nombres; con 2 o más usa plural. */
  function plank(names) {
    const list = [].concat(names || []).filter(Boolean);
    if (!list.length) return null;
    const who = list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
    return h('div', { class: 'plank-line' }, '🏴‍☠️ ¡' + who + (list.length === 1 ? ' tendrá' : ' tendrán') + ' que caminar por la plancha!');
  }

  function shell(opts) {
    const root = h('div', { class: 'game' + (visualMode ? ' visual' : '') });
    const eye = h('button', {
      class: 'icon-btn visual-toggle' + (visualMode ? ' on' : ''),
      title: 'Modo público: oculta los controles y agranda la consigna',
      'aria-label': 'Modo público',
      'aria-pressed': String(visualMode),
      onclick: () => {
        visualMode = !visualMode;
        root.classList.toggle('visual', visualMode);
        eye.classList.toggle('on', visualMode);
        eye.setAttribute('aria-pressed', String(visualMode));
      }
    }, '👁');

    /* opts.swap = { S, route, gameId, steps, ids() }: muestra «🔄 Cambio» durante la partida. */
    const sw = opts.swap;
    const swapBtn = sw && sw.steps.includes(sw.S.step) && sw.ids().length ? h('button', {
      class: 'btn btn-ghost mini swap-btn hide-in-visual',
      title: 'Alguien sale y otra persona toma su lugar',
      onclick: () => swapPlayer(sw)
    }, '🔄 Cambio') : null;

    const head = h('div', { class: 'game-head' },
      h('button', {
        class: 'icon-btn', title: 'Salir al catálogo (la partida queda guardada)', 'aria-label': 'Salir del juego',
        onclick: () => {
          const inProgress = MCR.gameInProgress;
          MCR.go('catalog');
          if (inProgress) toast('Partida guardada. Al volver a abrir el juego podrás continuarla.');
        }
      }, '×'),
      h('div', { class: 'game-title' },
        h('span', { class: 'gt-name' }, opts.title),
        opts.sub ? h('span', { class: 'gt-sub' }, opts.sub) : null
      ),
      h('div', { class: 'game-actions' }, opts.right || null, swapBtn, eye)
    );

    const body = h('div', { class: 'game-body' });
    const foot = h('div', { class: 'game-foot' });
    root.append(head, body, foot);
    return { root, body, head, foot, nav: null };
  }

  function gameFlow(current, opts) {
    opts = opts || {};
    const steps = opts.steps || ['Reglas', 'Preparación', 'Partida'];
    return h('nav', { class: 'game-flow', 'aria-label': 'Pasos del juego' },
      steps.map((label, index) => h('div', {
        class: 'game-flow-step' + (index === current ? ' current' : '') + (index < current ? ' done' : ''),
        'aria-current': index === current ? 'step' : null
      },
        h('span', { class: 'game-flow-index' }, index < current ? '✓' : String(index + 1)),
        h('span', { class: 'game-flow-label' }, label)
      ))
    );
  }

  const gameTrails = new Map();

  /* Pasos que todavía no son «partida en curso»: no se guardan ni se ofrecen para continuar. */
  const PRE_GAME_STEPS = ['intro', 'portada', 'rules', 'reglas'];

  function snapshotOf(state) {
    return JSON.parse(JSON.stringify(state, (name, value) => name === 'ctrl' ? null : value));
  }

  /* Al restaurar, cualquier reloj que corría queda en pausa (nadie pierde tiempo). */
  function pauseTimers(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.status === 'running' && 'remaining' in obj && 'total' in obj) obj.status = 'paused';
    Object.values(obj).forEach(pauseTimers);
    return obj;
  }

  function timeAgo(at) {
    const min = Math.round((Date.now() - at) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return 'hace ' + min + ' min';
    const hrs = Math.round(min / 60);
    return 'hace ' + hrs + (hrs === 1 ? ' hora' : ' horas');
  }

  /* Cierra una partida: borra su guardado en curso. Lo llaman los botones de finalizar. */
  function endGame(route) {
    MCR.store.live.clear(route);
    gameTrails.delete(route);
    MCR.gameInProgress = false;
  }

  /* Registra la partida y ofrece «Deshacer» por si se tocó el resultado equivocado. */
  function recordWithUndo(event, message) {
    const ev = MCR.store.recordEvent(event);
    toast(message || 'Partida registrada', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          MCR.store.removeEvent(ev.id);
          toast('Registro eliminado');
          if (MCR.refresh) MCR.refresh();
        }
      }
    });
    return ev;
  }

  /* Barra de cierre común a todos los juegos. Antes «Otra partida»/«Revancha»
     descartaban el resultado sin avisar; ahora toda salida registra, salvo
     «Descartar», que pide confirmación.
       opts.event()  → devuelve el objeto para recordEvent (se llama al registrar)
       opts.again()  → deja el estado listo para otra partida (mismos jugadores si aplica)
       opts.reset()  → estado inicial del juego (para descartar o salir) */
  function finishBar(opts) {
    const route = opts.route;
    const record = () => {
      recordWithUndo(opts.event());
      endGame(route);
    };
    return h('div', { class: 'action-bar game-step-actions finish-bar' },
      h('button', { class: 'btn btn-quiet danger-text', onclick: () => {
        confirm('Descartar resultado', 'Esta partida no se guardará en el historial ni contará para la rotación. ¿Descartar?', 'Sí, descartar', true)
          .then((ok) => { if (!ok) return; endGame(route); opts.reset(); MCR.go('catalog'); toast('Resultado descartado · elige el siguiente juego'); });
      } }, 'Descartar'),
      h('div', { class: 'action-bar-info' }),
      h('button', { class: 'btn btn-ghost', onclick: () => { record(); opts.again(); MCR.go(route); } }, opts.againLabel || 'Registrar y jugar otra'),
      /* Al terminar se vuelve a la pestaña Juegos para elegir el siguiente. */
      h('button', { class: 'btn btn-gold btn-xl', onclick: () => { record(); opts.reset(); MCR.go('catalog'); } }, 'Registrar · siguiente juego →')
    );
  }

  /* Historial local de pantallas, separado del historial de partidas guardadas.
     También: guarda la partida en curso y, al entrar de nuevo, ofrece continuarla. */
  function gameNavigation(opts) {
    const { root, view, foot, route, state, restore } = opts;
    const preGame = PRE_GAME_STEPS.includes(state.step);
    MCR.gameInProgress = !preGame;

    if (root.dataset.newEntry === 'true' && preGame) {
      const saved = MCR.store.live.load(route);
      if (saved && saved.state && !PRE_GAME_STEPS.includes(saved.state.step)) {
        view.prepend(h('section', { class: 'resume-banner', role: 'region', 'aria-label': 'Partida en curso' },
          h('div', { class: 'resume-copy' },
            h('strong', null, 'Hay una partida sin terminar'),
            h('span', null, 'Se guardó ' + timeAgo(saved.at) + '. Puedes seguir justo donde se quedó.')
          ),
          h('div', { class: 'resume-actions' },
            h('button', { class: 'btn btn-ghost', onclick: () => {
              MCR.store.live.clear(route);
              view.querySelector('.resume-banner').remove();
              toast('Partida anterior descartada');
            } }, 'Descartar'),
            h('button', { class: 'btn btn-gold', onclick: () => {
              gameTrails.delete(route);
              restore(pauseTimers(saved.state));
              MCR.go(route);
            } }, 'Continuar partida →')
          )
        ));
      }
    } else if (!preGame) {
      MCR.store.live.save(route, snapshotOf(state));
    }

    let trail = gameTrails.get(route);
    if (!trail || root.dataset.newEntry === 'true' || ['intro', 'portada'].includes(state.step)) {
      trail = { entries: [], key: null, snapshot: null, saved: MCR.store.get().events.length };
      gameTrails.set(route, trail);
    }
    MCR.disposeGame = () => { if (state.ctrl) state.ctrl.stop(); };
    // No se permite retroceder a un resultado anterior a un registro definitivo.
    const saved = MCR.store.get().events.length;
    if (saved !== trail.saved) { trail.entries = []; trail.snapshot = null; trail.key = null; trail.saved = saved; }
    const screenKey = (s) => JSON.stringify([s.step, s.category && s.category.id, s.buyer, s.challenged, s.current, s.turn, s.idx, s.round]);
    const key = screenKey(state);
    if (trail.snapshot && trail.key !== key) {
      const previousIndex = trail.entries.map(screenKey).lastIndexOf(key);
      if (previousIndex >= 0) trail.entries.splice(previousIndex);
      else trail.entries.push(trail.snapshot);
    }
    trail.key = key;
    trail.snapshot = snapshotOf(state);

    let bar = foot.querySelector('.action-bar');
    if (!bar) {
      bar = h('div', { class: 'action-bar game-step-actions' });
      foot.append(bar);
    }
    bar.classList.add('game-step-actions');
    // Trasladar el retroceso existente sin cambiar su función ni duplicarlo.
    const explicit = Array.from(view.querySelectorAll('button')).concat(Array.from(foot.querySelectorAll('button')))
      .find((button) => button.textContent.trim().startsWith('←'));
    if (explicit) {
      const oldParent = explicit.parentElement;
      explicit.classList.add('game-back');
      bar.prepend(explicit);
      if (oldParent !== bar && !oldParent.childElementCount) oldParent.remove();
    } else {
      const canBack = trail.entries.length > 0;
      bar.prepend(h('button', { class: 'btn btn-ghost game-back', onclick: () => {
        if (!canBack) { MCR.go('catalog'); return; }
        if (state.ctrl) state.ctrl.stop();
        const previous = trail.entries.pop();
        trail.key = null;
        trail.snapshot = null;
        previous.ctrl = null;
        restore(pauseTimers(previous));
        MCR.go(route);
      } }, canBack ? '← Atrás' : '← Juegos'));
    }
  }

  /* ---------- selector de jugadores ---------- */

  function playerMeta(id, gameId) {
    const st = MCR.store.stats();
    const s = st[id] || { plays: 0, byGame: {} };
    const here = gameId ? ((s.byGame || {})[gameId] || 0) : null;
    if (here == null) {
      return s.plays === 0 ? 'sin jugar' : s.plays + (s.plays === 1 ? ' juego' : ' juegos');
    }
    if (here === 0) {
      return 'nunca aquí · ' + (s.plays === 0 ? 'sin jugar' : s.plays + ' en total');
    }
    return here + (here === 1 ? ' vez aquí' : ' veces aquí') + ' · ' + s.plays + ' en total';
  }

  /* Orden por columnas: la lista llena la columna 1 de arriba abajo, luego la 2 y así sucesivamente.
     Devuelve las posiciones en orden de cuadrícula (fila a fila); null marca un hueco. */
  function columnOrder(items, cols) {
    const n = items.length;
    const rows = Math.ceil(n / cols);
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = c * rows + r;
        out.push(i < n ? items[i] : null);
      }
    }
    return out;
  }

  function playerGrid(ids, opts) {
    opts = opts || {};
    const wrap = h('div', { class: 'opt-grid player-options' });
    const sorted = ids.slice().sort((a, b) => {
      const pa = MCR.store.byId(a);
      const pb = MCR.store.byId(b);
      return (pa ? pa.name : '').localeCompare(pb ? pb.name : '', 'es', { sensitivity: 'base' });
    });
    columnOrder(sorted, 3).forEach((id) => {
      if (id == null) {
        wrap.append(h('span', { class: 'opt-slot-empty', 'aria-hidden': 'true' }));
        return;
      }
      const p = MCR.store.byId(id);
      if (!p) return;
      const selected = opts.selected && opts.selected.includes(id);
      const disabled = opts.disabledIds && opts.disabledIds.includes(id) && !selected;
      const btn = h('button', {
        class: 'opt player-option' + (selected ? ' sel' : '') + (disabled ? ' used' : ''),
        'aria-pressed': String(!!selected),
        'data-focus-key': 'player-' + id,
        disabled: disabled,
        onclick: () => opts.onToggle && opts.onToggle(id)
      },
        h('span', { class: 'player-option-check' }, h('span', { class: 'chk' }, '✓')),
        h('span', { class: 'player-option-copy' },
          h('span', { class: 'player-option-name' }, p.name),
          h('small', { class: 'player-option-meta' },
            disabled ? (opts.disabledText || 'ya está ocupado') : playerMeta(id, opts.gameId))
        )
      );
      wrap.append(btn);
    });
    return wrap;
  }

  /* ---------- cabecera de paso (misma composición en todos los juegos) ---------- */

  /* La etiqueta «Paso N · …» ya la comunica la barra de pasos superior (gameFlow),
     así que solo se muestra cuando aporta contexto propio, p. ej. «Turno · Equipo 1». */
  function setupHead(opts) {
    opts = opts || {};
    const pill = opts.step && !/^Paso \d/.test(opts.step) ? opts.step : null;
    return h('div', { class: 'page-head' },
      h('div', { class: 'page-head-main' },
        pill ? h('div', { class: 'step-pill' }, pill) : null,
        h('h2', { class: 'page-title' }, opts.title || ''),
        opts.sub ? h('p', { class: 'page-sub' }, opts.sub) : null
      ),
      opts.actions && opts.actions.length
        ? h('div', { class: 'page-head-actions' }, opts.actions)
        : null
    );
  }

  function ruleGuide(opts) {
    opts = opts || {};
    return h('section', { class: 'panel rule-guide', 'aria-label': 'Cómo se juega' },
      h('h3', { class: 'rule-guide-title' }, opts.title || 'Cómo se juega'),
      opts.summary ? h('p', { class: 'rule-guide-summary' }, opts.summary) : null,
      h('ol', { class: 'rule-guide-steps' }, (opts.steps || []).map((step) => h('li', null, step))),
      opts.note ? h('p', { class: 'rule-guide-note' }, opts.note) : null
    );
  }

  function gameIntro(opts) {
    opts = opts || {};
    return h('div', { class: 'grid portada game-intro-wrap' },
      h('section', { class: 'stage game-intro' },
        opts.kicker ? h('div', { class: 'stage-label' }, opts.kicker) : null,
        h('h1', { class: 'stage-word game-intro-title' }, opts.title || ''),
        h('p', { class: 'stage-note game-intro-summary' }, opts.summary || ''),
        opts.details && opts.details.length
          ? h('div', { class: 'rule-chips game-intro-details' }, opts.details.map((detail) => h('span', { class: 'rule-chip' }, detail)))
          : null,
        h('button', { class: 'btn btn-gold btn-xl', onclick: opts.onContinue }, opts.action || 'Ver reglas →')
      )
    );
  }

  /* Barra de pasos: siempre Atrás a la izquierda, info al centro y acción principal a la derecha. */
  function stepBar(opts) {
    opts = opts || {};
    return h('div', { class: 'action-bar game-step-actions' },
      h('button', { class: 'btn btn-ghost', onclick: opts.back }, opts.backLabel || '← Atrás'),
      h('div', { class: 'action-bar-info' + (opts.ok ? ' ok' : ''), 'data-ready-info': '' }, opts.info || ''),
      h('button', {
        class: 'btn btn-gold btn-xl',
        disabled: !!opts.disabled,
        onclick: opts.next
      }, opts.nextLabel || 'Siguiente →')
    );
  }

  /* Página de reglas con la misma lectura en los 7 juegos:
       objetivo (goal) → cómo se juega (steps) → cómo se gana (win)
       y, al lado, ficha rápida (facts) + casos especiales (special).
     Así quien nunca jugó entiende el juego sin explicaciones externas, y quien
     conduce puede leerlo en voz alta. Los textos deben coincidir con lo que la
     app hace en cada pantalla: si cambias una mecánica, cambia también su regla. */
  function gameRulesPage(opts) {
    opts = opts || {};
    const facts = opts.facts || [];
    const special = opts.special || opts.keyPoints || [];
    return h('div', { class: 'grid game-rules-page' },
      setupHead({
        title: opts.title || 'Cómo se juega',
        sub: opts.headerSub || null
      }),
      h('div', { class: 'rules-content' },
        h('section', { class: 'panel rule-guide', 'aria-label': 'Cómo se juega' },
          opts.goal || opts.summary ? h('div', { class: 'rule-block' },
            h('h3', { class: 'rule-label' }, 'Objetivo'),
            h('p', { class: 'rule-guide-summary' }, opts.goal || opts.summary)
          ) : null,
          h('div', { class: 'rule-block' },
            h('h3', { class: 'rule-label' }, opts.contentTitle || 'Cómo se juega'),
            h('ol', { class: 'rule-guide-steps' }, (opts.steps || []).map((step) => h('li', null, step)))
          ),
          opts.win ? h('div', { class: 'rule-block rule-win' },
            h('h3', { class: 'rule-label' }, 'Cómo se gana'),
            h('p', null, opts.win)
          ) : null,
          opts.note ? h('p', { class: 'rule-guide-note' }, opts.note) : null,
          opts.origin ? h('p', { class: 'rule-origin' }, opts.origin) : null
        ),
        opts.aside || h('aside', { class: 'panel rules-aside' },
          facts.length ? h('div', { class: 'rule-facts' }, facts.map(([label, value]) =>
            h('div', { class: 'rule-fact' }, h('span', { class: 'rule-fact-l' }, label), h('strong', { class: 'rule-fact-v' }, value))
          )) : null,
          special.length ? [
            h('h3', { class: 'rule-label' }, opts.asideTitle || 'Si pasa algo'),
            h('ul', { class: 'rules-key-points' }, special.map((point) => h('li', null, point)))
          ] : null
        )
      ),
      h('div', { class: 'action-bar game-step-actions' },
        h('button', { class: 'btn btn-ghost', onclick: opts.onBack }, '← Atrás'),
        h('div', { class: 'action-bar-info' }, opts.actionNote || 'Siguiente: preparación'),
        h('button', { class: 'btn btn-gold btn-xl', onclick: opts.onContinue }, opts.action || 'Elegir participantes →')
      )
    );
  }

  /* ---------- selector de personas (peoplePicker) ----------

     Un solo componente con tres modos, porque no todas las dinámicas eligen igual:

       mode 'roster'  → «¿Quiénes juegan?» (Teléfono, Cascarón, Sándwich, Sin palabras).
                        Juega casi todo el mundo: vienen todos marcados y la bandeja
                        muestra solo a quienes DESCANSAN. Lista A–Z.
       mode 'pick'    → elegir a unos pocos entre muchos (Caricaturas 3, Almohadazo 2,
                        Te la compro 3–6). La bandeja muestra lugares numerados; la
                        lista va ordenada por rotación justa y marca «Le toca».
       mode 'single'  → elegir a una persona y seguir (reemplazo en Caricaturas).
                        Tocar = confirmar; la sugerencia aparece primero.

     Piezas comunes: buscador que también añade («+ Añadir “Ana”»), filas compactas de
     una línea con estado (seleccionado / disponible / le toca / acaba de jugar),
     ausentes al pie para reactivarlos sin salir del juego.

     Rotación justa: el orden «le toca primero» usa los mismos criterios que
     MCR.store.recommend (menos partidas → menos veces en este juego → jugó hace más),
     pero sin azar, para que la lista no salte en cada repintado. Nunca bloquea una
     elección manual: solo informa. */

  const pickerQuery = {};          // texto del buscador por juego (sobrevive al repintado)
  let pickerRefocus = null;        // tras elegir desde el buscador, vuelve el foco al buscador

  function normText(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function fairOrder(ids, gameId) {
    const st = MCR.store.stats();
    const zero = { plays: 0, last: 0, byGame: {} };
    return ids.slice().sort((a, b) => {
      const sa = st[a] || zero;
      const sb = st[b] || zero;
      if (sa.plays !== sb.plays) return sa.plays - sb.plays;
      if (gameId) {
        const ga = (sa.byGame || {})[gameId] || 0;
        const gb = (sb.byGame || {})[gameId] || 0;
        if (ga !== gb) return ga - gb;
      }
      if (sa.last !== sb.last) return sa.last - sb.last;
      return MCR.store.nameOf(a).localeCompare(MCR.store.nameOf(b), 'es', { sensitivity: 'base' });
    });
  }

  function azOrder(ids) {
    return ids.slice().sort((a, b) => MCR.store.nameOf(a).localeCompare(MCR.store.nameOf(b), 'es', { sensitivity: 'base' }));
  }

  /* Texto corto de una línea: cuántas veces aquí y en total. */
  function shortMeta(id, gameId) {
    const s = MCR.store.stats()[id] || { plays: 0, byGame: {} };
    const here = gameId ? ((s.byGame || {})[gameId] || 0) : null;
    if (!s.plays) return 'Aún no juega';
    if (here === 0) return 'Nuevo aquí · ' + s.plays + ' en total';
    if (here == null) return s.plays + (s.plays === 1 ? ' juego' : ' juegos');
    return here + '× aquí · ' + s.plays + ' en total';
  }

  function searchIcon() {
    const span = h('span', { class: 'pp-search-ico', 'aria-hidden': 'true' });
    span.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>';
    return span;
  }

  function peoplePicker(opts) {
    opts = opts || {};
    const mode = opts.mode || 'pick';
    const key = opts.key || opts.gameId || 'default';
    const pool = (opts.ids || MCR.store.players().map((p) => p.id)).filter((id) => MCR.store.byId(id));
    const selected = (opts.selected || []).filter((id) => pool.includes(id));
    const max = mode === 'single' ? 1 : (opts.max || Infinity);
    const min = opts.min || 0;
    const full = selected.length >= max;
    const emit = (ids) => opts.onChange && opts.onChange(ids);
    const toggle = opts.onToggle || ((id) => {
      if (selected.includes(id)) return emit(selected.filter((x) => x !== id));
      if (full) return toast('Ya están los ' + max + '. Quita a alguien de arriba para cambiar.');
      emit(selected.concat(id));
    });
    const choose = (id) => {
      if (pickerQuery[key]) { pickerQuery[key] = ''; pickerRefocus = key; }
      if (mode === 'single') return opts.onPick && opts.onPick(id);
      toggle(id);
    };

    /* «Le toca»: los mejores candidatos de la rotación para los lugares libres. */
    const ordered = mode === 'roster' || opts.order === 'az' ? azOrder(pool) : fairOrder(pool, opts.gameId);
    const free = mode === 'pick' && isFinite(max) ? Math.max(0, Math.min(opts.target || max, max) - selected.length)
      : mode === 'single' ? 1 : 0;
    const dueSet = new Set(fairOrder(pool.filter((id) => !selected.includes(id)), opts.gameId).slice(0, free));
    const st = MCR.store.stats();
    const lastAt = Math.max(0, ...Object.values(st).map((s) => s.last || 0));
    const justPlayed = (id) => lastAt > 0 && (st[id] || {}).last === lastAt;

    /* ---- cabecera: título, conteo y UNA acción masiva que cambia según el estado ---- */
    let bulk = null;
    if (opts.bulk !== false && mode === 'pick' && isFinite(max)) {
      /* target: cuántos sugiere (p. ej. Te la compro admite 3–6 pero lo ideal son 5). */
      const target = Math.min(opts.target || max, max);
      const need = target - selected.length;
      bulk = h('button', {
        class: 'btn btn-quiet mini pp-bulk',
        'data-focus-key': 'pp-bulk-' + key,
        onclick: () => {
          if (need > 0) {
            const add = fairOrder(pool.filter((id) => !selected.includes(id)), opts.gameId).slice(0, need);
            if (!add.length) return toast('No queda nadie disponible');
            emit(selected.concat(add));
          } else {
            const next = MCR.store.recommendFresh(Math.max(target, selected.length), selected, { gameId: opts.gameId, exclude: MCR.store.players().map((p) => p.id).filter((id) => !pool.includes(id)) });
            if (next.length === selected.length && next.every((id) => selected.includes(id))) toast('No hay otra combinación disponible');
            else emit(next);
          }
        }
      }, !selected.length ? '✨ Sugerir ' + target : need > 0 ? '✨ Completar ' + need : '✨ Otra sugerencia');
    } else if (opts.bulk !== false && mode === 'roster') {
      const all = selected.length === pool.length;
      bulk = h('button', {
        class: 'btn btn-quiet mini pp-bulk',
        'data-focus-key': 'pp-bulk-' + key,
        title: all ? 'Quitar a todas las personas para elegir una por una' : 'Incluir a todas las personas presentes',
        onclick: () => emit(all ? [] : pool.slice())
      }, all ? 'Quitar a todos' : '✓ Incluir a todos');
    }
    const extra = (opts.tools || []).filter(Boolean);

    const count = opts.count != null ? opts.count
      : mode === 'single' ? null
      : mode === 'roster' ? selected.length + ' de ' + pool.length
      : !isFinite(max) ? selected.length + ' elegidos'
      : min && min !== max ? selected.length + ' de ' + min + '–' + max
      : selected.length + ' / ' + max;
    const countOk = selected.length >= (min || 1) && selected.length <= max;

    const head = h('div', { class: 'pp-head' },
      h('div', { class: 'pp-title' },
        h('span', { class: 'panel-title' }, opts.title || 'Participantes'),
        count ? h('span', { class: 'badge' + (countOk ? ' ok' : ' gold') }, count) : null
      ),
      bulk || extra.length ? h('div', { class: 'pp-tools' }, extra, bulk) : null
    );

    /* ---- bandeja: qué hay elegido (pick) o quién descansa (roster) ---- */
    let tray = null;
    if (opts.tray !== false && mode === 'pick') {
      const slots = isFinite(max) ? max : Math.max(selected.length, min);
      const items = [];
      /* Los lugares opcionales vacíos se resumen en una sola pastilla: la bandeja
         muestra lo que importa (elegidos + lugares obligatorios) sin ocupar 2 filas. */
      const shown = Math.max(selected.length, min || 0);
      const optionalFree = isFinite(max) ? Math.max(0, max - shown) : 0;
      for (let i = 0; i < (optionalFree > 1 ? shown : slots); i++) {
        const id = selected[i];
        items.push(id
          ? h('button', {
              class: 'pp-slot filled',
              'data-focus-key': 'pp-slot-' + id,
              title: 'Quitar a ' + MCR.store.nameOf(id),
              'aria-label': 'Quitar a ' + MCR.store.nameOf(id),
              onclick: () => toggle(id)
            },
              h('span', { class: 'pp-slot-n' }, String(i + 1)),
              h('span', { class: 'pp-slot-name' }, MCR.store.nameOf(id)),
              h('span', { class: 'pp-x', 'aria-hidden': 'true' }, '×'))
          : h('span', { class: 'pp-slot empty' + (i < min ? ' required' : '') },
              h('span', { class: 'pp-slot-n' }, String(i + 1)),
              h('span', { class: 'pp-slot-name' }, i < min ? 'Libre' : 'Opcional')));
      }
      if (optionalFree > 1) {
        items.push(h('span', { class: 'pp-slot empty' }, h('span', { class: 'pp-slot-name' }, '+ hasta ' + optionalFree + ' más (opcional)')));
      }
      if (!isFinite(max) && selected.length >= slots) {
        selected.slice(slots).forEach((id) => items.push(h('button', { class: 'pp-slot filled', onclick: () => toggle(id) },
          h('span', { class: 'pp-slot-name' }, MCR.store.nameOf(id)), h('span', { class: 'pp-x' }, '×'))));
      }
      tray = h('div', { class: 'pp-tray' }, items,
        selected.length ? h('button', {
          class: 'btn btn-quiet mini pp-clear',
          'data-focus-key': 'pp-clear-' + key,
          onclick: () => emit([])
        }, 'Vaciar') : null
      );
    } else if (opts.tray !== false && mode === 'roster') {
      const resting = azOrder(pool.filter((id) => !selected.includes(id)));
      tray = h('div', { class: 'pp-tray resting' + (resting.length ? '' : ' none') },
        h('span', { class: 'pp-tray-label' }, resting.length ? 'Descansan' : 'Juegan todas las personas presentes'),
        resting.slice(0, 12).map((id) => h('button', {
          class: 'pp-chip',
          title: 'Volver a sumar a ' + MCR.store.nameOf(id),
          onclick: () => toggle(id)
        }, h('span', null, MCR.store.nameOf(id)), h('span', { class: 'pp-plus', 'aria-hidden': 'true' }, '+'))),
        resting.length > 12 ? h('span', { class: 'pp-more' }, '+' + (resting.length - 12) + ' más') : null
      );
    }

    /* ---- buscador que también añade ---- */
    const query = pickerQuery[key] || '';
    const input = h('input', {
      class: 'input pp-search',
      type: 'search',
      value: query,
      placeholder: opts.onAdd ? 'Buscar o añadir a alguien…' : 'Buscar por nombre…',
      'aria-label': 'Buscar participante',
      'data-focus-key': 'pp-search-' + key,
      autocomplete: 'off'
    });

    const list = h('div', { class: 'pp-list pick-scroll', role: 'list' });
    const addRow = opts.onAdd ? h('button', { class: 'pp-row pp-add', hidden: true, onclick: () => addFromQuery() }) : null;
    const emptyRow = h('div', { class: 'pp-empty', hidden: true }, 'Nadie coincide con la búsqueda.');

    const rows = ordered.map((id) => {
      const p = MCR.store.byId(id);
      const on = selected.includes(id);
      const due = dueSet.has(id) && !on;
      const blocked = !on && full && mode === 'pick';
      const meta = opts.metaFor ? opts.metaFor(id)
        : mode === 'roster' && !on ? 'Descansa · toca para sumar'
        : shortMeta(id, opts.gameId);
      const tag = opts.tagFor ? opts.tagFor(id)
        : due ? (mode === 'single' ? 'Sugerido' : 'Le toca')
        : justPlayed(id) && !on ? 'Acaba de jugar' : null;
      const row = h('button', {
        class: 'pp-row' + (on ? ' on' : '') + (due ? ' due' : '') + (blocked ? ' blocked' : '') + (mode === 'single' ? ' single' : ''),
        role: 'listitem',
        'aria-pressed': String(on),
        'data-focus-key': 'pp-' + key + '-' + id,
        'data-name': normText(p.name),
        onclick: () => choose(id)
      },
        mode === 'single'
          ? h('span', { class: 'pp-avatar' }, on ? '✓' : initials(p.name))
          : h('span', { class: 'pp-check', 'aria-hidden': 'true' }, on ? '✓' : ''),
        h('span', { class: 'pp-txt' },
          h('span', { class: 'pp-name' }, p.name),
          h('span', { class: 'pp-meta' }, meta)
        ),
        tag ? h('span', { class: 'pp-tag' + (tag === 'Acaba de jugar' ? ' recent' : '') }, tag) : null
      );
      return row;
    });
    if (addRow) list.append(addRow);
    list.append(...rows, emptyRow);
    if (!rows.length) {
      emptyRow.hidden = false;
      emptyRow.textContent = opts.emptyText || 'No hay personas disponibles. Escribe un nombre para añadir.';
    }

    const filter = () => {
      const q = normText(input.value);
      pickerQuery[key] = input.value;
      let visible = 0;
      let exact = false;
      rows.forEach((row) => {
        const show = !q || row.dataset.name.includes(q);
        row.hidden = !show;
        if (show) visible += 1;
        if (q && row.dataset.name === q) exact = true;
      });
      if (addRow) {
        addRow.hidden = !q || exact;
        addRow.replaceChildren(h('span', { class: 'pp-check add', 'aria-hidden': 'true' }, '+'),
          h('span', { class: 'pp-txt' }, h('span', { class: 'pp-name' }, 'Añadir «' + input.value.trim() + '»'),
            h('span', { class: 'pp-meta' }, 'Nueva persona · Enter')));
      }
      if (rows.length) emptyRow.hidden = visible > 0 || (addRow && !addRow.hidden);
    };

    function addFromQuery() {
      const name = input.value.trim();
      if (!name || !opts.onAdd) return;
      const p = MCR.store.addPlayer(name);
      if (!p) return;
      pickerQuery[key] = '';
      pickerRefocus = key;
      toast(p.reused ? (p.wasAway ? p.name + ' vuelve como presente' : p.name + ' ya estaba en la lista') : p.name + ' se agregó');
      opts.onAdd(p);
    }

    input.addEventListener('input', filter);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; filter(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const shown = rows.filter((r) => !r.hidden);
      if (shown.length === 1 && input.value.trim()) shown[0].click();
      else if (addRow && !addRow.hidden) addFromQuery();
    });
    filter();
    if (pickerRefocus === key) {
      pickerRefocus = null;
      setTimeout(() => { if (input.isConnected) input.focus({ preventScroll: true }); }, 0);
    }

    /* ---- ausentes: reactivar sin ir a la pantalla Jugadores ---- */
    const absent = opts.showAbsent === false ? [] : MCR.store.roster().filter((p) => p.absent);
    const absentBox = absent.length && opts.onAdd ? h('div', { class: 'pp-absent' },
      h('span', { class: 'pp-tray-label' }, 'Ausentes · toca si ya llegó'),
      absent.map((p) => h('button', {
        class: 'pp-chip ghost',
        title: p.name + ' llegó: marcar presente y sumar',
        onclick: () => { MCR.store.setPresent(p.id, true); toast(p.name + ' vuelve como presente'); opts.onAdd(MCR.store.byId(p.id)); }
      }, h('span', null, p.name), h('span', { class: 'pp-plus', 'aria-hidden': 'true' }, '+')))
    ) : null;

    return h('section', { class: 'panel people-picker mode-' + mode },
      head,
      opts.hint ? h('p', { class: 'pp-hint' }, opts.hint) : null,
      tray,
      h('div', { class: 'pp-search-wrap' }, searchIcon(), input),
      list,
      absentBox
    );
  }

  /* ---------- tablero de equipos (misma pieza que el juego 01) ---------- */


  function teamRow(opts) {
    opts = opts || {};
    const variant = opts.variant || 'check';
    const cls = ['player-row', 'v-' + variant];
    if (opts.on === true) cls.push('on');
    if (opts.on === false) cls.push('off');
    if (opts.className) cls.push(opts.className);

    const kids = [];
    if (opts.leading) kids.push(opts.leading);
    kids.push(h('div', { class: 'player-avatar' }, opts.initials || initials(opts.name)));
    kids.push(h('div', { class: 'player-main' },
      h('div', { class: 'player-name' }, opts.name || ''),
      opts.meta ? h('div', { class: 'player-meta' }, opts.meta) : null
    ));
    (opts.actions || []).forEach((action) => { if (action) kids.push(action); });

    return h('div', {
      class: cls.join(' '),
      'data-row-id': opts.id || null,
      'data-row-team': opts.team != null ? String(opts.team) : null
    }, kids);
  }

  let teamBoardId = 0;
  function teamBoard(opts) {
    opts = opts || {};
    const team = opts.team === 1 ? 1 : 0;
    const key = opts.key != null ? opts.key : team;
    const collapsed = !!opts.collapsed;
    const rows = opts.rows || [];
    const preview = opts.preview || [];

    const id = 'team-board-' + (++teamBoardId);
    const name = opts.name || ('Equipo ' + (team + 1));
    let bodyScroll = 0;
    const toggle = () => {
      const next = !section.classList.contains('collapsed');
      if (next) bodyScroll = body.scrollTop;
      // El foco nunca debe quedar dentro del contenido que estamos ocultando.
      top.focus({ preventScroll: true });
      section.classList.toggle('collapsed', next);
      top.setAttribute('aria-expanded', String(!next));
      top.setAttribute('aria-label', (next ? 'Expandir ' : 'Contraer ') + name);
      if (!next) body.scrollTop = bodyScroll;
      if (opts.onToggleCollapse) opts.onToggleCollapse(next);
    };

    const section = h('section', {
      class: 'team-board ' + (team === 0 ? 'a' : 'b') +
        (collapsed ? ' collapsed' : '') + (opts.compact ? ' compact' : ''),
      'data-team-board': String(key)
    });

    const top = h('header', {
      class: 'team-top',
      role: 'button',
      tabindex: '0',
      'aria-expanded': String(!collapsed),
      'aria-label': (collapsed ? 'Expandir ' : 'Contraer ') + name,
      'aria-controls': id + '-body ' + id + '-summary',
      onclick: toggle,
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }
    },
      h('div', { class: 'team-emblem' }, String(opts.emblem != null ? opts.emblem : team + 1)),
      h('div', { class: 'team-heading' },
        h('div', { class: 'team-kicker' }, opts.kicker || (team === 0 ? 'Azul' : 'Rojo')),
        h('div', { class: 'team-name' }, name)
      ),
      h('div', { class: 'team-meta' },
        h('span', { class: 'team-count', 'data-team-count': String(key) }, opts.count || String(rows.length)),
        h('span', { class: 'team-chevron' }, '⌄')
      )
    );

    const body = h('div', { id: id + '-body', class: 'team-body' },
      rows.length ? rows : h('div', { class: 'empty' }, opts.empty || 'Este equipo está vacío.')
    );

    const collapsedBox = h('div', { id: id + '-summary', class: 'team-collapsed' },
      h('div', { class: 'team-collapsed-avatars' },
        preview.slice(0, 6).map((txt) => h('span', { class: 'mini-avatar' }, txt)),
        preview.length > 6 ? h('span', { class: 'mini-avatar more' }, '+' + (preview.length - 6)) : null
      ),
      h('div', { class: 'team-collapsed-txt' }, opts.collapsedText || ''),
      h('button', {
        class: 'btn btn-ghost',
        onclick: (e) => { e.stopPropagation(); toggle(); }
      }, 'Abrir equipo')
    );

    section.append(top, body, collapsedBox);

    if (opts.footer) {
      section.append(h('div', { class: 'team-foot' },
        h('span', { class: 'tiny' }, opts.footerLabel || ''),
        opts.footer
      ));
    }

    return section;
  }

  /* Panel de equilibrio + herramientas de equipo (homologado en todos los juegos con equipos).
     Jerarquía: el estado (conteo y barra) se lee primero; las herramientas son
     discretas y viven en una sola fila debajo:
       · 🎲 Mezclar        → siempre visible, ícono + palabra (acción reversible).
       · ⚖ Reequilibrar   → solo aparece cuando hay 2+ de diferencia.
       · extra (opts.extra) → acciones contextuales del juego (p. ej. «Incluir a los que descansan»).
       · Sumar a alguien  → campo compacto; la persona va al equipo más corto.
     Así «Añadir participante» ya no es un panel suelto lejos de los equipos. */
  function teamBalance(counts, labels, opts) {
    opts = opts || {};
    counts = counts || [0, 0];
    labels = labels || ['Equipo 1', 'Equipo 2'];
    const a = counts[0];
    const b = counts[1];
    const diff = Math.abs(a - b);
    const state = diff <= 1 ? 'ok' : diff === 2 ? 'warn' : 'danger';
    const total = a + b;
    const msg = opts.message || (diff === 0 ? 'Parejos' : diff === 1 ? 'Diferencia de 1 · está bien' : 'Diferencia de ' + diff + ' · conviene reequilibrar');
    return h('div', { class: 'balance team-tools ' + state, 'aria-live': 'polite', 'data-balance': '' },
      h('div', { class: 'balance-top' },
        h('div', { class: 'balance-counts' },
          h('span', { class: 'balance-side' }, h('span', { class: 'balance-dot' }), labels[0] + ' ', h('span', { class: 'balance-num', 'data-bcount': '0' }, String(a))),
          h('span', { class: 'balance-vs' }, 'vs'),
          h('span', { class: 'balance-side b' }, h('span', { class: 'balance-dot' }), labels[1] + ' ', h('span', { class: 'balance-num', 'data-bcount': '1' }, String(b)))
        ),
        h('div', { class: 'balance-msg', 'data-bmsg': '' }, msg)
      ),
      h('div', { class: 'balance-track' },
        h('i', { class: 'a', 'data-bbar': '0', style: { width: (total ? (a / total) * 100 : 50) + '%' } }),
        h('i', { class: 'b', 'data-bbar': '1', style: { width: (total ? (b / total) * 100 : 50) + '%' } })
      ),
      h('div', { class: 'team-toolbar' },
        h('div', { class: 'team-toolbar-actions' },
          opts.onMix ? h('button', { class: 'btn btn-ghost mini', 'data-focus-key': 'team-mix', title: 'Repartir de nuevo al azar, evitando repetir compañeros', onclick: opts.onMix }, '🎲 Mezclar') : null,
          opts.onRebalance ? h('button', { class: 'btn btn-ghost mini', 'data-rebalance': '', 'data-focus-key': 'team-rebalance', hidden: diff < 2, onclick: opts.onRebalance }, '⚖ Reequilibrar') : null,
          (opts.extra || []).filter(Boolean)
        ),
        opts.onAdd ? quickAdd(opts.onAdd, { placeholder: opts.addPlaceholder || 'Sumar a alguien…', compact: true }) : null
      )
    );
  }

  /* Selector homologado: se ve igual en todos los juegos y abre una lista táctil. */
  function picker(opts) {
    opts = opts || {};
    const value = opts.value || '';
    const p = value ? MCR.store.byId(value) : null;
    const btn = h('button', { class: 'picker' + (p ? ' has-value' : ''), type: 'button' },
      p ? h('span', { class: 'picker-avatar' }, initials(p.name)) : h('span', { class: 'picker-avatar empty' }, '+'),
      h('span', { class: 'picker-txt' },
        h('span', { class: 'picker-name' }, p ? p.name : (opts.placeholder || 'Elegir persona')),
        h('span', { class: 'picker-meta' }, p ? playerMeta(p.id, opts.gameId) : 'Toca para elegir')
      ),
      h('span', { class: 'picker-caret' }, '⌄')
    );

    btn.addEventListener('click', () => {
      const layer = document.getElementById('layer');
      layer.classList.add('on');

      const close = (val) => {
        scrim.remove();
        if (!layer.querySelector('.scrim')) layer.classList.remove('on');
        if (val !== undefined && opts.onChange) opts.onChange(val || null);
      };

      const excluded = (opts.exclude || []).filter((id) => id !== value);
      const grid = playerGrid(MCR.store.players().map((x) => x.id), {
        gameId: opts.gameId,
        selected: value ? [value] : [],
        disabledIds: excluded,
        onToggle: (id) => close(id)
      });

      const scrim = h('div', {
        class: 'scrim',
        onclick: (e) => { if (e.target === scrim) close(undefined); }
      },
        h('div', { class: 'modal picker-modal' },
          h('h3', null, opts.title || 'Elegir persona'),
          opts.message ? h('p', null, opts.message) : null,
          grid,
          h('div', { class: 'btn-row' },
            value ? h('button', { class: 'btn btn-ghost', onclick: () => close('') }, 'Quitar') : null,
            h('button', { class: 'btn btn-ghost', onclick: () => close(undefined) }, 'Cancelar')
          )
        )
      );
      layer.append(scrim);
    });

    return btn;
  }

  function playerList(ids) {
    return ids.map((id) => MCR.store.nameOf(id)).join(' · ');
  }

  /* ---------- añadir jugador sin salir del juego ---------- */

  function quickAdd(onAdd, opts) {
    opts = opts || {};
    const input = h('input', {
      class: 'input',
      placeholder: opts.placeholder || 'Añadir jugador…',
      'aria-label': 'Nombre del nuevo jugador'
    });
    /* Si el nombre ya existe no se duplica: se reactiva a esa persona (llegó tarde
       o había quedado como ausente) y se suma igual al juego actual. */
    const add = () => {
      const name = input.value.trim();
      if (!name) return;
      const p = MCR.store.addPlayer(name);
      if (!p) return;
      input.value = '';
      toast(p.reused ? (p.wasAway ? p.name + ' ya estaba en la lista: vuelve como presente' : p.name + ' ya estaba en la lista') : p.name + ' se agregó');
      if (onAdd) onAdd(p);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return h('div', { class: 'quick-add' + (opts.compact ? ' compact' : '') },
      input,
      h('button', { class: 'btn ' + (opts.compact ? 'btn-ghost' : 'btn-gold') + ' mini', onclick: add, 'aria-label': 'Añadir' }, opts.compact ? '+' : '+ Añadir')
    );
  }

  return {
    h, clear, fmt, durationText, durationPicker, initials, avatar, toast, dialog, confirm, reveal, swapPlayer, withSwapped, choiceGrid, confirmBtn, ring, countdown,
    newTimer, timerView, endGame, recordWithUndo, finishBar,
    shell, gameNavigation, playerGrid, playerMeta, peoplePicker, fairOrder, searchIcon, picker, playerList, quickAdd,
    sfx, plank, columnOrder, setupHead, stepBar, gameFlow, gameIntro, gameRulesPage, ruleGuide, teamRow, teamBoard, teamBalance
  };
})();
