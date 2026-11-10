import * as store from './store.js';
import { h, startQuiz } from './quiz.js';
import { renderImport } from './import.js';

const root = document.getElementById('app');
let selected = [];

async function ensureStartDeck() {
  if (store.getDecks().length) return;
  try {
    const d = await (await fetch('./decks/vde-5-sicherheitsregeln.json')).json();
    store.saveDeck({ id: d.deck.id, title: d.deck.title, cards: d.cards });
  } catch { /* offline und noch nicht gecacht */ }
}

function home() {
  const decks = store.getDecks();
  const checks = new Map();
  const list = decks.map((d) => {
    const s = store.stats(d);
    const cb = h('input', { type: 'checkbox', checked: selected.includes(d.id) ? '' : false });
    cb.checked = selected.includes(d.id) || (!selected.length && decks.length === 1);
    checks.set(d.id, cb);
    return h('div', { class: 'deck' },
      h('label', { class: 'opt' }, cb, h('span', {}, h('strong', {}, d.title),
        h('small', {}, ` ${d.cards.length} Karten · Trefferquote ${s.quote == null ? '–' : s.quote + ' %'}`))),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { if (confirm(`Fortschritt von "${d.title}" zurücksetzen?`)) { store.resetProgress(d.id); home(); } } }, 'Fortschritt zurücksetzen'),
        h('button', { class: 'btn ghost danger', onclick: () => { if (confirm(`Deck "${d.title}" löschen?`)) { store.deleteDeck(d.id); home(); } } }, 'Löschen')));
  });
  const los = h('button', { class: 'btn primary', onclick: () => {
    selected = decks.filter((d) => checks.get(d.id).checked).map((d) => d.id);
    if (!selected.length) { alert('Bitte mindestens ein Deck auswählen.'); return; }
    location.hash = '#quiz';
  } }, 'Los');
  root.replaceChildren(
    h('div', { class: 'bar' }, h('h1', {}, 'Karteikarten'), h('button', { class: 'btn ghost', onclick: () => (location.hash = '#import') }, 'Import')),
    ...(list.length ? list : [h('p', {}, 'Keine Decks vorhanden. Importiere eines.')]), los);
}

function route() {
  const r = location.hash || '#home';
  if (r === '#quiz' && selected.length) startQuiz(root, selected, () => (location.hash = '#home'));
  else if (r === '#import') renderImport(root, () => (location.hash = '#home'));
  else { if (r !== '#home') location.hash = '#home'; home(); }
}

window.addEventListener('hashchange', route);
await ensureStartDeck();
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
