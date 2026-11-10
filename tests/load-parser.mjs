// app.js에서 "시험지 파싱" 관련 함수만 잘라내 node에서 실행할 수 있게 해 주는 도우미.
// app.js를 따로 복사하지 않으므로, app.js를 고치면 테스트도 바로 그 코드를 검사한다.
import fs from 'node:fs';
import vm from 'node:vm';

function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('app.js에서 찾을 수 없음: ' + startMarker);
  const e = endMarker ? src.indexOf(endMarker, s) : src.length;
  if (e < 0) throw new Error('app.js에서 찾을 수 없음: ' + endMarker);
  return src.slice(s, e);
}

export function loadParser() {
  const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const code = [
    slice(src, 'const DOMAIN_CODE = {', 'const DOMAIN_COLORS'),
    slice(src, 'function parseExplanationText(', 'async function addUsageToExisting'),
    slice(src, 'const KNOWN_INSTITUTION_ALIASES', 'function applyFileNameMetaToBatchForm'),
    slice(src, 'const NOISE_PATTERNS = [', 'let batchParsed = [];'),
    ';({ DOMAIN_CODE, parseExamText, guessDomain, detectNeedsImage, parseExplanationText, parseFileNameMeta, isNoise });'
  ].join('\n');
  return vm.runInNewContext(code, {});
}
