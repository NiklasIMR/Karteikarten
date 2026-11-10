// Einziger Zugriff auf localStorage (später ggf. IndexedDB)
const K_DECKS = 'kk:decks';
const K_PROG = 'kk:progress';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const getDecks = () => Object.values(read(K_DECKS));
export const getDeck = (id) => read(K_DECKS)[id];
export function saveDeck(deck) {
  const d = read(K_DECKS);
  d[deck.id] = deck;
  write(K_DECKS, d);
  // Fortschritt nur für noch vorhandene Karten behalten
  const p = read(K_PROG);
  if (p[deck.id]) {
    const ids = new Set(deck.cards.map((c) => c.id));
    for (const cid of Object.keys(p[deck.id])) if (!ids.has(cid)) delete p[deck.id][cid];
    write(K_PROG, p);
  }
}
export function deleteDeck(id) {
  const d = read(K_DECKS); delete d[id]; write(K_DECKS, d);
  resetProgress(id);
}
export const getProgress = (deckId) => read(K_PROG)[deckId] || {};
export function resetProgress(deckId) {
  const p = read(K_PROG); delete p[deckId]; write(K_PROG, p);
}
export function record(deckId, cardId, correct) {
  const p = read(K_PROG);
  const r = ((p[deckId] ||= {})[cardId] ||= { right: 0, wrong: 0, lastSeen: 0 });
  correct ? r.right++ : r.wrong++;
  r.lastSeen = Date.now();
  write(K_PROG, p);
}
// "Doch richtig": letzte falsche Antwort als richtig zählen
export function fix(deckId, cardId) {
  const p = read(K_PROG);
  const r = p[deckId]?.[cardId];
  if (!r || r.wrong < 1) return;
  r.wrong--; r.right++;
  write(K_PROG, p);
}
export function stats(deck) {
  const p = getProgress(deck.id);
  let right = 0, wrong = 0;
  for (const c of deck.cards) { const r = p[c.id]; if (r) { right += r.right; wrong += r.wrong; } }
  return { right, wrong, quote: right + wrong ? Math.round((100 * right) / (right + wrong)) : null };
}
