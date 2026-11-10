import * as store from './store.js';
import { h } from './quiz.js';

export function validate(data) {
  const err = [];
  if (!data || typeof data !== 'object') return ['Datei ist kein JSON-Objekt.'];
  if (data.format !== 'karteikarten-v1') err.push('Feld "format" muss "karteikarten-v1" sein.');
  if (!data.deck || typeof data.deck.id !== 'string' || !data.deck.id) err.push('Feld "deck.id" fehlt.');
  if (!data.deck || typeof data.deck.title !== 'string' || !data.deck.title) err.push('Feld "deck.title" fehlt.');
  if (!Array.isArray(data.cards) || !data.cards.length) { err.push('Feld "cards" fehlt oder ist leer.'); return err; }
  const ids = new Set();
  const strs = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === 'string' && x);
  data.cards.forEach((c, i) => {
    const n = `Karte ${i + 1}`;
    if (!c || typeof c !== 'object') { err.push(`${n}: kein Objekt.`); return; }
    if (typeof c.id !== 'string' || !c.id) err.push(`${n}: Feld "id" fehlt.`);
    else if (ids.has(c.id)) err.push(`${n}: "id" ${c.id} ist doppelt.`);
    else ids.add(c.id);
    if (typeof c.question !== 'string' || !c.question) err.push(`${n}: Feld "question" fehlt.`);
    if (c.explanation != null && typeof c.explanation !== 'string') err.push(`${n}: "explanation" muss Text sein.`);
    if (c.type === 'input') {
      if (!strs(c.answers)) err.push(`${n}: "answers" muss eine Liste von Texten sein.`);
      if (c.mode != null && !['fuzzy', 'exact'].includes(c.mode)) err.push(`${n}: "mode" muss "fuzzy" oder "exact" sein.`);
    } else if (c.type === 'choice') {
      if (!strs(c.options) || c.options.length < 2) err.push(`${n}: "options" braucht mindestens 2 Texte.`);
      else if (!Array.isArray(c.correct) || !c.correct.length || !c.correct.every((x) => Number.isInteger(x) && x >= 0 && x < c.options.length))
        err.push(`${n}: "correct" muss gültige Indizes von "options" enthalten.`);
      else if (!c.multi && c.correct.length !== 1) err.push(`${n}: bei "multi": false muss "correct" genau einen Index haben.`);
    } else if (c.type === 'order') {
      if (!strs(c.items) || c.items.length < 2) err.push(`${n}: "items" braucht mindestens 2 Texte.`);
    } else err.push(`${n}: "type" muss input, choice oder order sein.`);
  });
  return err;
}

export const AI_PROMPT = `Erstelle ein Karteikarten-Deck als reines JSON im Format "karteikarten-v1" zum Thema: <THEMA EINFÜGEN>.

Regeln:
- Gib NUR reines JSON aus, ohne Markdown-Codeblock und ohne Erklärtext.
- deck.id: kurzer, eindeutiger Kleinbuchstaben-Slug. Jede card.id muss im Deck eindeutig sein (z. B. "t1-text", "mc1", "ord1").
- Typen: "input" (Texteingabe), "choice" (Ankreuzen), "order" (Reihenfolge).
- input: "answers" = alle akzeptierten Schreibweisen; "mode": "fuzzy" (Standard, toleriert Tippfehler) oder "exact" (für Zahlen); "inputmode": "text" oder "numeric".
- choice: "options" = Antworttexte, "correct" = Liste der richtigen Indizes (ab 0), "multi": true/false, "shuffle": true/false.
- order: "items" stehen in der RICHTIGEN Reihenfolge (die App mischt sie).
- Jede Karte bekommt eine kurze "explanation".
- Sprache: Deutsch.

Schema und Beispiel:
{
  "format": "karteikarten-v1",
  "deck": { "id": "beispiel", "title": "Beispiel-Deck" },
  "cards": [
    { "id": "t1-text", "type": "input", "question": "Hauptstadt von Frankreich?", "answers": ["Paris"], "mode": "fuzzy", "inputmode": "text", "explanation": "Paris liegt an der Seine." },
    { "id": "t2-zahl", "type": "input", "question": "Wie viele Beine hat eine Spinne?", "answers": ["8"], "mode": "exact", "inputmode": "numeric", "explanation": "Spinnen sind Achtbeiner." },
    { "id": "mc1", "type": "choice", "question": "Welche Farbe hat der Himmel?", "options": ["Blau", "Grün", "Rot"], "correct": [0], "multi": false, "shuffle": true, "explanation": "Rayleigh-Streuung." },
    { "id": "mc2", "type": "choice", "question": "Welche sind Primzahlen?", "options": ["2", "4", "5", "9"], "correct": [0, 2], "multi": true, "shuffle": true, "explanation": "4 und 9 sind teilbar." },
    { "id": "ord1", "type": "order", "question": "Ordne die Zahlen aufsteigend.", "items": ["1", "2", "3"], "explanation": "Aufsteigend sortiert." }
  ]
}`;

export function renderImport(root, onDone) {
  const msg = h('div', { class: 'msg' });
  const file = h('input', { type: 'file', accept: '.json,application/json', class: 'file' });
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch { msg.className = 'msg bad'; msg.textContent = 'Datei ist kein gültiges JSON.'; return; }
    const errs = validate(data);
    if (errs.length) { msg.className = 'msg bad'; msg.replaceChildren(h('strong', {}, 'Import abgebrochen:'), h('ul', {}, errs.map((e) => h('li', {}, e)))); return; }
    const deck = { id: data.deck.id, title: data.deck.title, cards: data.cards };
    if (store.getDeck(deck.id) && !confirm(`Deck "${deck.id}" existiert bereits. Ersetzen? (Fortschritt für weiterhin vorhandene Karten bleibt erhalten.)`)) return;
    store.saveDeck(deck);
    onDone();
  });
  const copy = h('button', { class: 'btn ghost', onclick: async () => {
    try { await navigator.clipboard.writeText(AI_PROMPT); msg.className = 'msg ok'; msg.textContent = 'Prompt kopiert.'; }
    catch { msg.className = 'msg bad'; msg.textContent = 'Kopieren nicht möglich.'; }
  } }, 'Format für KI kopieren');
  root.replaceChildren(
    h('div', { class: 'bar' }, h('h1', {}, 'Import'), h('button', { class: 'btn ghost', onclick: onDone }, 'Zurück')),
    h('p', {}, 'JSON-Datei im Format karteikarten-v1 auswählen:'), file, copy, msg);
}
