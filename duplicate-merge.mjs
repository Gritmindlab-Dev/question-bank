export function mergeUsage(keep = [], incoming = []) {
  const seen = new Set();
  return [...keep, ...incoming].filter(entry => {
    if (!entry || !(entry.institution || entry.when || entry.grade)) return false;
    const key = JSON.stringify(['institution', 'when', 'grade'].map(k => String(entry[k] || '').trim()));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function contentDifferences(a, b) {
  return [['stem','발문'],['passage','지문'],['choices','보기'],['answer','정답'],['images','이미지'],['dataBlocks','표/그래프'],['explanation','해설']]
    .filter(([key]) => JSON.stringify(a[key] || '') !== JSON.stringify(b[key] || ''))
    .map(([, label]) => label);
}
export function mergePatches(keep, drop, token, time) {
  if (keep.id === drop.id || keep.deleted || drop.deleted) throw new Error('이미 정리되었거나 같은 문항입니다. 다시 검사해주세요.');
  return {
    keep: {usageLog: mergeUsage(keep.usageLog, drop.usageLog), updatedAt: time},
    drop: {deleted: true, mergedInto: keep.id, mergeToken: token, mergedAt: time, updatedAt: time}
  };
}
