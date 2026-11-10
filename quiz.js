import * as store from './store.js';

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

export function normalize(s) {
  return String(s).toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

export function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export function checkInput(card, val) {
  const v = normalize(val);
  return card.answers.some((a) => {
    const n = normalize(a);
    if (card.mode === 'exact') return v === n;
    return lev(v, n) <= Math.floor(0.15 * n.length);
  });
}

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function startQuiz(root, deckIds, onExit) {
  const entries = deckIds.map(store.getDeck).filter(Boolean).flatMap((d) => d.cards.map((card) => ({ deckId: d.id, card })));
  if (!entries.length) { onExit(); return; }
  let right = 0, total = 0, count = 0, last = null;
  const retry = [];

  function pick() {
    count++;
    const i = retry.findIndex((r) => r.due <= count);
    if (i >= 0) return retry.splice(i, 1)[0].entry;
    const prog = {};
    const pool = entries.filter((e) => entries.length < 2 || e !== last);
    const w = pool.map((e) => {
      const p = (prog[e.deckId] ||= store.getProgress(e.deckId))[e.card.id];
      if (!p) return 2;
      return Math.max(0.5, 1 + 2 * p.wrong - 0.5 * p.right);
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < pool.length; k++) { r -= w[k]; if (r <= 0) return pool[k]; }
    return pool[pool.length - 1];
  }

  function next() {
    const entry = pick();
    last = entry;
    const { card } = entry;
    const counter = h('span', { class: 'counter' }, `${right}/${total}`);
    const body = h('div', { class: 'card' });
    const fb = h('div', { class: 'feedback' });
    root.replaceChildren(
      h('div', { class: 'bar' }, counter, h('button', { class: 'btn ghost', onclick: onExit }, 'Beenden')),
      body, fb);
    body.append(h('h2', {}, card.question));
    let answered = false;

    function done(correct, solution, lock) {
      if (answered) return; answered = true;
      lock && lock();
      store.record(entry.deckId, card.id, correct);
      total++; if (correct) right++; else retry.push({ entry, due: count + 4 });
      counter.textContent = `${right}/${total}`;
      fb.className = 'feedback ' + (correct ? 'ok' : 'bad');
      fb.replaceChildren(
        h('strong', {}, correct ? 'Richtig!' : 'Falsch'),
        solution ? h('p', {}, 'Lösung: ', solution) : null,
        card.explanation ? h('p', { class: 'expl' }, card.explanation) : null);
      if (!correct && card.type === 'input')
        fb.append(h('button', { class: 'btn ghost', onclick: (ev) => {
          store.fix(entry.deckId, card.id); right++;
          const ri = retry.findIndex((r) => r.entry === entry); if (ri >= 0) retry.splice(ri, 1);
          counter.textContent = `${right}/${total}`;
          fb.className = 'feedback ok'; fb.firstChild.textContent = 'Als richtig gewertet';
          ev.target.remove();
        } }, 'Doch richtig'));
      const nb = h('button', { class: 'btn primary', onclick: next }, 'Weiter');
      fb.append(nb); nb.focus();
    }

    if (card.type === 'input') {
      const inp = h('input', { type: 'text', inputmode: card.inputmode || 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
      const go = () => done(checkInput(card, inp.value), card.answers[0], () => { inp.disabled = true; ok.disabled = true; });
      const ok = h('button', { class: 'btn primary', onclick: go }, 'Prüfen');
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      body.append(inp, ok);
    } else if (card.type === 'choice') {
      const order = card.shuffle === false ? card.options.map((_, i) => i) : shuffle(card.options.map((_, i) => i));
      const sel = new Set();
      const rows = order.map((i) => {
        const cb = h('input', { type: card.multi ? 'checkbox' : 'radio', name: 'opt' });
        const row = h('label', { class: 'opt' }, cb, h('span', {}, card.options[i]));
        cb.addEventListener('change', () => {
          if (card.multi) { cb.checked ? sel.add(i) : sel.delete(i); }
          else { sel.clear(); sel.add(i); check(); }
        });
        return { i, cb, row };
      });
      const check = () => {
        const corr = new Set(card.correct);
        const ok = corr.size === sel.size && [...corr].every((x) => sel.has(x));
        done(ok, card.correct.map((c) => card.options[c]).join(' · '), () => {
          rows.forEach(({ i, cb, row }) => {
            cb.disabled = true;
            if (corr.has(i)) row.classList.add('right'); else if (sel.has(i)) row.classList.add('wrong');
          });
          btn && (btn.disabled = true);
        });
      };
      const btn = card.multi ? h('button', { class: 'btn primary', onclick: check }, 'Prüfen') : null;
      body.append(...rows.map((r) => r.row), btn);
    } else if (card.type === 'order') {
      const pool = shuffle(card.items.map((_, i) => i));
      const target = [];
      const poolEl = h('div', { class: 'list' }), tgtEl = h('ol', { class: 'list target' });
      const chk = h('button', { class: 'btn primary', onclick: () => {
        const ok = target.every((v, p) => v === p);
        done(ok, h('ol', {}, card.items.map((t) => h('li', {}, t))), () => {
          chk.disabled = true;
          [...tgtEl.children].forEach((li, p) => li.classList.add(target[p] === p ? 'right' : 'wrong'));
          [...tgtEl.children].forEach((li) => (li.onclick = null));
        });
      } }, 'Prüfen');
      const draw = () => {
        poolEl.replaceChildren(...pool.map((i) => h('button', { class: 'item', onclick: () => { if (answered) return; pool.splice(pool.indexOf(i), 1); target.push(i); draw(); } }, card.items[i])));
        tgtEl.replaceChildren(...target.map((i) => h('li', { class: 'item', onclick: () => { if (answered) return; target.splice(target.indexOf(i), 1); pool.push(i); draw(); } }, card.items[i])));
        chk.style.display = pool.length ? 'none' : '';
      };
      body.append(h('p', { class: 'hint' }, 'Antippen zum Einsortieren, in der Liste antippen zum Zurücknehmen.'), tgtEl, poolEl, chk);
      draw();
    }
    const first = body.querySelector('input[type=text]'); first && first.focus();
  }
  next();
}
