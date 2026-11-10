// 시험지 자동 인식(일괄 붙여넣기) 회귀 테스트
// 실행: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadParser } from './load-parser.mjs';

const P = loadParser();
const read = name => fs.readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const plain = v => JSON.parse(JSON.stringify(v)); // vm 컨텍스트 배열을 일반 배열로

test('혼합형 시험지: 문항 분리·영역·보기·묶음지문·법조문·이미지 감지', () => {
  const exp = JSON.parse(read('mixed-exam.expected.json'));
  const items = P.parseExamText(read('mixed-exam.txt'), '의사소통능력', '테스트 출처', '미정', '');
  const byNum = Object.fromEntries(items.map(i => [i.examQuestionNumber, i]));

  assert.equal(items.length, exp.count, '문항 수');
  assert.deepEqual(plain(items.map(i => i.examQuestionNumber)), exp.numbers, '원문항번호');
  assert.deepEqual(plain(items.map(i => i.domain)), exp.domains, '영역 헤더 인식');
  assert.deepEqual(plain(items.map(i => i.choices.length)), exp.choiceCounts, '보기 개수');
  assert.deepEqual(plain(items.filter(i => i.needsImage).map(i => i.examQuestionNumber)), exp.needsImage, '이미지 필요 감지');
  for (const [n, ch] of Object.entries(exp.choices)) assert.deepEqual(plain(byNum[n].choices), ch, n + '번 보기');
  for (const [n, s] of Object.entries(exp.stems)) assert.equal(byNum[n].stem, s, n + '번 발문');
  for (const [n, list] of Object.entries(exp.passageIncludes))
    for (const s of list) assert.ok(byNum[n].passage.includes(s), `${n}번 지문에 "${s}" 포함`);
  for (const [n, list] of Object.entries(exp.passageExcludes))
    for (const s of list) assert.ok(!byNum[n].passage.includes(s), `${n}번 지문에 "${s}" 없어야 함`);
  const all = JSON.stringify(items);
  for (const s of exp.noiseNeverAppears) assert.ok(!all.includes(s), `머리말 잡음 "${s}" 제거`);
  assert.ok(items.every(i => i.source === '테스트 출처' && !i._domainGuessed));
});

test('영역 표시가 없는 시험지: 안내문 제거 + 영역 추측', () => {
  const items = P.parseExamText(read('no-header-exam.txt'), '의사소통능력', '', '미정', '');
  assert.equal(items.length, 4);
  assert.deepEqual(plain(items.map(i => i.domain)), ['의사소통능력', '수리능력', '문제해결능력', '정보능력']);
  assert.ok(items.every(i => i._domainGuessed));
  assert.equal(items[0].stem, '다음 글을 읽고 내용과 일치하지 않는 것은?');
  assert.ok(!items[0].stem.includes('총 4문항'));
});

test('지문 안 번호 목록은 "?" 있는 진짜 다음 문항과 구분', () => {
  const text = [
    '1. 다음 규정을 읽고 옳은 것은?', '제1조 기준은 다음과 같다.',
    '① 가 ② 나 ③ 다 ④ 라 ⑤ 마',
    '2. 다음 중 옳지 않은 것은?', '① 가 ② 나 ③ 다 ④ 라 ⑤ 마'
  ].join('\n');
  const items = P.parseExamText(text, '의사소통능력', '', '미정', '');
  assert.deepEqual(plain(items.map(i => i.examQuestionNumber)), [1, 2]);
});

test('"?" 없이 끝나는 계산 문항도 다음 문항으로 분리', () => {
  const text = [
    '1. 의자 17개에 79명이 앉는다. 5인용 의자는 몇 개인지 구하시오.', '① 9개 ② 11개 ③ 12개 ④ 13개 ⑤ 14개',
    '2. 다음 중 옳은 것은?', '① 가 ② 나 ③ 다 ④ 라 ⑤ 마'
  ].join('\n');
  const items = P.parseExamText(text, '수리능력', '', '미정', '');
  assert.equal(items.length, 2);
  assert.equal(items[0].choices.length, 5);
});

test('이미지 감지: 오탐 방지', () => {
  assert.equal(P.detectNeedsImage('다음은 문제해결 방법에 대한 설명이다. 다른 하나는?', '', ['가', '나', '다', '라', '마']), false);
  assert.equal(P.detectNeedsImage('10%의 소금물의 농도는?', '', ['4', '6', '8', '10', '12']), false);
  assert.equal(P.detectNeedsImage('다음 중 옳은 것은?', '긴 지문이 있습니다. 이 지문은 충분히 깁니다.', ['가', '나', '다', '라', '마']), false);
  assert.equal(P.detectNeedsImage('다음 표를 보고 ㉠에 들어갈 값은?', '연도 2020 2021', ['1', '2', '3', '4', '5']), true);
});

test('파일명에서 기관·시기·학년 추출', () => {
  const m1 = P.parseFileNameMeta('NCS 모의고사 의수문 45제(포항제철공업고등학교)_250304 최종.pdf');
  assert.equal(m1.institution, '포항제철공업고등학교');
  assert.equal(m1.when, '2025년 3월');
  assert.equal(P.parseFileNameMeta('NCS 모의고사 44제(포항제철공업고등학교)_202403.pdf').when, '2024년 3월');
  assert.equal(P.parseFileNameMeta('수도공고 3회차 모의고사_20260901.pdf').when, '2026년 9월');
  assert.equal(P.parseFileNameMeta('2024년 3월 국민대 2학년 모의고사.pdf').when, '2024년 3월');
  assert.equal(P.parseFileNameMeta('2024년 3월 15일 모의고사.pdf').when, '2024년 3월 15일');
  assert.equal(P.parseFileNameMeta('수도전기공업고등학교_모의고사_261110.pdf').institution, '수도전기공업고등학교');
  assert.equal(P.parseFileNameMeta('국민대 1~2학년 모의고사.pdf').grade, '1~2학년');
  assert.equal(P.parseFileNameMeta('[50B216v2410] NCS모의고사_50제.pdf').when, '');
});

test('해설 일괄 입력: 번호별로 해설 분리', () => {
  const r = plain(P.parseExplanationText('1. 정답은 ①이다.\n이유는 다음과 같다.\n2. 정답은 ③이다.\n\n10) 계산하면 6이다.'));
  assert.deepEqual(r, { 1: '정답은 ①이다.\n이유는 다음과 같다.', 2: '정답은 ③이다.', 10: '계산하면 6이다.' });
});
