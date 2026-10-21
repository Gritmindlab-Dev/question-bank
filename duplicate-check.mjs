// Shared by single uploads, batch uploads and the existing-question audit.
export const SIM_THRESHOLD = 0.70;
export function normalize(value) {
  return String(value || '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .normalize('NFKC').toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[!?()\[\]{}'"“”‘’·※:;]/g, '');
}
export function diceSim(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2); counts.set(g, (counts.get(g) || 0) + 1);
  }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2), n = counts.get(g) || 0;
    if (n) { shared++; counts.set(g, n - 1); }
  }
  return 2 * shared / (a.length + b.length - 2);
}
function imageKey(value) {
  const src = String(value).match(/src\s*=\s*["']([^"']+)["']/i)?.[1] || String(value);
  return src.match(/\/d\/([\w-]+)/)?.[1] || src.match(/[?&]id=([\w-]+)/)?.[1] || src;
}
export function questionSimilarity(a, b) {
  const stem = diceSim(a.stem, b.stem);
  const passageA = normalize(a.passage), passageB = normalize(b.passage);
  const choicesA = (a.choices || []).map(normalize).filter(Boolean).sort();
  const choicesB = (b.choices || []).map(normalize).filter(Boolean).sort();
  const choices = diceSim(choicesA.join('\n'), choicesB.join('\n'));
  const imagesA = (a.images || []).map(imageKey).filter(Boolean);
  const imagesB = (b.images || []).map(imageKey).filter(Boolean);
  const sameImages = imagesA.length > 0 && imagesA.length === imagesB.length &&
    [...imagesA].sort().every((v, i) => v === [...imagesB].sort()[i]);
  // A shared passage or generic instruction alone is insufficient evidence.
  let score = stem;
  if (passageA || passageB) score = 0.55 * stem + 0.45 * diceSim(passageA, passageB);
  if (choicesA.length && choicesB.length) score = 0.65 * score + 0.35 * choices;
  if ((passageA || passageB) && stem < 0.4) score = Math.min(score, 0.69);
  // OCR/imports sometimes move text between the stem and passage fields.
  const joinedA = normalize((a.stem || '') + (a.passage || ''));
  const joinedB = normalize((b.stem || '') + (b.passage || ''));
  if (joinedA.length >= 20 && joinedA === joinedB) {
    score = Math.max(score, choicesA.length && choicesB.length ? 0.65 + 0.35 * choices : 1);
  }
  if (sameImages && stem >= 0.7) score = Math.max(score, 0.8 * stem + 0.2);
  // Identical short boilerplate with no supporting content should not match.
  if (!passageA && !passageB && !choicesA.length && !choicesB.length && !sameImages && normalize(a.stem).length < 12) return 0;
  return score;
}
export function bestDuplicate(item, questions, excludeId = null) {
  let best = {sim: 0, q: null};
  for (const q of questions) {
    if (q.deleted || (excludeId && q.id === excludeId)) continue;
    const sim = questionSimilarity(item, q);
    if (sim > best.sim) best = {sim, q};
  }
  return best;
}
