// HWPX 내보내기: 본문 XML 생성 검사 (실행: node --test tests/hwpx.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../hwpx-export.mjs';

// 아주 단순한 XML 짝 맞춤 검사 (여는 태그/닫는 태그 순서)
function assertWellFormed(xml) {
  const body = xml.replace(/<\?xml[^>]*\?>/, '');
  const stack = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) { const top = stack.pop(); assert.equal(top, name, `닫는 태그 불일치: </${name}> (열린 것: <${top}>)`); }
    else stack.push(name);
  }
  assert.equal(stack.length, 0, '닫히지 않은 태그: ' + stack.join(','));
}

const head = JSON.parse(fs.readFileSync(new URL('../hwpx-template/section-head.json', import.meta.url), 'utf8'));

test('특수문자는 이스케이프되고 문단·보기 번호가 붙는다', () => {
  const xml = H.questionXml({ stem: '다음 중 <보기> & "옳은" 것은?', passage: '첫 줄이다.\n둘째 줄이다.', choices: ['가', '나', '다', '라', '마'] }, 3);
  assertWellFormed(xml);
  assert.ok(xml.includes('3. 다음 중 &lt;보기&gt; &amp; &quot;옳은&quot; 것은?'));
  assert.ok(xml.includes('① 가') && xml.includes('⑤ 마'));
  assert.ok(xml.includes('borderFillIDRef="2"'), '지문은 테두리 상자');
  assert.equal((xml.match(/<hp:t>첫 줄이다\.<\/hp:t>|<hp:t>둘째 줄이다\.<\/hp:t>/g) || []).length, 2, '문장이 끝난 줄은 각각 문단');
});

test('PDF에서 끊긴 줄은 이어 붙이고, 항목 표시 줄은 새 줄로', () => {
  const t = H.joinWrappedLines('상대방의 얼굴과\n몸의 움직임을 관찰해야\n한다.\n<보기>\nㄱ. 첫째\n㉠ 둘째 항목은 길어서\n다음 줄로 이어진다.\n※ 주석');
  assert.equal(t, '상대방의 얼굴과 몸의 움직임을 관찰해야 한다.\n<보기>\nㄱ. 첫째\n㉠ 둘째 항목은 길어서 다음 줄로 이어진다.\n※ 주석');
  assert.equal(H.joinWrappedLines('설치기준은 다음과\n(가 ) 수동 차단을\n포함한 절차\n(1) 최초 계획'), '설치기준은 다음과\n(가 ) 수동 차단을 포함한 절차\n(1) 최초 계획');
});

test('지문을 표 앞(안내)과 뒤(<보기>)로 나눔', () => {
  assert.deepEqual(H.splitPassage('다음은 자료이다.\n<보기>\nㄱ. 가'), ['다음은 자료이다.', '<보기>\nㄱ. 가']);
  assert.deepEqual(H.splitPassage('설명만 있음'), ['설명만 있음', '']);
});

test('지문이 없으면 상자를 만들지 않는다', () => {
  const xml = H.questionXml({ stem: '계산하시오.', passage: '', choices: ['1', '2'] }, 1);
  assert.ok(!xml.includes('borderFillIDRef="2"'));
});

test('표: 병합 칸은 한 번만, 머리 칸은 음영 스타일', () => {
  const rows = [
    [{ text: '구분', head: true, rowspan: 2 }, { text: '2025년', head: true, colspan: 2 }, null],
    [null, { text: '상반기', head: true }, { text: '하반기', head: true }],
    [{ text: '수요', head: true }, { text: '2.8' }, { text: '2.5' }]
  ];
  const xml = H.tableXml(rows);
  assertWellFormed(xml);
  assert.equal((xml.match(/<hp:tc /g) || []).length, 7); // 2 + 2 + 3 (병합으로 가려진 칸 제외)
  assert.ok(xml.includes('rowCnt="3" colCnt="3"'));
  assert.ok(xml.includes('<hp:cellSpan colSpan="1" rowSpan="2"/>') && xml.includes('<hp:cellSpan colSpan="2" rowSpan="1"/>'));
  assert.ok(xml.includes('borderFillIDRef="15"') && xml.includes('borderFillIDRef="10"'));
});

test('그림 크기는 본문 폭을 넘지 않게 줄어든다', () => {
  const xml = H.picXml('image1', 2000, 1000);
  assertWellFormed(xml);
  const cur = +xml.match(/<hp:curSz width="(\d+)"/)[1];
  assert.ok(cur <= 46488, '본문 폭 이내');
  assert.ok(xml.includes('binaryItemIDRef="image1"'));
});

test('정답표 / 정답 및 해설', () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, answer: String((i % 5) + 1), explanation: i === 0 ? '해설 첫 줄\n둘째 줄' : '' }));
  const t = H.answersXml(list);
  assertWellFormed(t);
  assert.ok(t.includes('pageBreak="1"'), '새 쪽에서 시작');
  assert.ok(t.includes('rowCnt="4"'), '10개씩 두 줄(번호/정답) × 2');
  const e = H.answersXml(list, { explanations: true });
  assertWellFormed(e);
  assert.ok(e.includes('1. ①') && e.includes('해설 첫 줄'));
});

test('구역 전체 XML과 패키지 목록', () => {
  const body = H.questionXml({ stem: 'A?', passage: 'p', choices: ['x'] }, 1) + H.blocksToXml([{ type: 'p', text: '<제목>' }, { type: 'table', rows: [[{ text: 'a', head: true }], [{ text: 'b' }]] }, { type: 'pic', binId: 'image1', w: 100, h: 50 }]);
  const sec = H.sectionXml(head, '테스트 & 제목', body);
  assertWellFormed(sec);
  assert.ok(sec.startsWith('<?xml') && sec.includes('<hp:secPr') && sec.endsWith('</hs:sec>'));
  assert.equal((sec.match(/<\?xml/g) || []).length, 1, 'XML 선언은 한 번만 (두 번이면 한글이 손상 파일로 판단)');
  const hpf = H.contentHpf('제목', [{ id: 'image1', file: 'image1.png', mime: 'image/png' }]);
  assertWellFormed(hpf);
  assert.ok(hpf.includes('href="BinData/image1.png"') && hpf.includes('href="Contents/section0.xml"'));
});
