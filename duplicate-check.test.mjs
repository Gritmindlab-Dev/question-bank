import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize, diceSim, questionSimilarity, bestDuplicate, SIM_THRESHOLD} from './duplicate-check.mjs';

const original = {id:'COM-0001', stem:'다음 글을 읽고 필자의 주장으로 가장 적절한 것을 고르시오.', passage:'지역 도서관은 누구나 지식을 나누고 함께 성장하는 공간이다.', choices:['공공 도서관 지원을 확대해야 한다','도서관을 폐쇄해야 한다','독서는 필요하지 않다','모든 책을 폐기해야 한다']};
test('Unicode, whitespace and HTML formatting do not hide duplicates', ()=>{
  const copy = {...original, stem:'<p>'+original.stem.normalize('NFD')+'</p>', passage:original.passage.replaceAll(' ', '\n\u200b')};
  assert.equal(questionSimilarity(original,copy), 1);
});
test('question metadata and choice order do not hide duplicates', ()=>{
  assert.equal(questionSimilarity(original,{...original,id:'COM-9999',source:'새 시험', choices:[...original.choices].reverse()}),1);
});
test('stem/passage boundary changes from imports are detected', ()=>{
  assert.equal(questionSimilarity(original,{...original,stem:original.stem+original.passage,passage:''}),1);
});
test('missing passage with matching stem and choices remains a candidate', ()=>{
  assert.ok(questionSimilarity(original,{...original,passage:''}) >= SIM_THRESHOLD);
});
test('common instruction with unrelated content is not enough', ()=>{
  const other = {...original, passage:'회사는 주간 생산량과 원자재 소비율을 계산했다.',choices:['12명','35명','80명','95명']};
  assert.ok(questionSimilarity(original,other) < SIM_THRESHOLD);
});
test('a shared passage with a different question is not enough', ()=>{
  assert.ok(questionSimilarity(original,{...original,stem:'밑줄 어휘의 반의어는?',choices:['크다','작다','가깝다','멀다']}) < SIM_THRESHOLD);
});
test('equivalent Drive image links support an image question', ()=>{
  const a={stem:'그림의 답은?', images:['https://drive.google.com/file/d/abc123/view']};
  assert.ok(questionSimilarity(a,{...a,images:['<img src="https://drive.google.com/uc?id=abc123">']})>=SIM_THRESHOLD);
});
test('short boilerplate and empty content do not create duplicates', ()=>{
  assert.equal(questionSimilarity({stem:'정답은?'},{stem:'정답은?'}),0);
  assert.equal(questionSimilarity({},{}),0);
  assert.equal(diceSim('a','a'),1);
});
test('math signs and decimal separators survive normalization', ()=>{
  assert.notEqual(normalize('x-1'),normalize('x1'));
  assert.notEqual(normalize('1.5'),normalize('15'));
});
test('all sources/domains are searched, deleted and self entries excluded', ()=>{
  const crossDomain={...original,id:'NUM-0002',domain:'수리능력'};
  const questions=[{...original,deleted:true},crossDomain];
  assert.equal(bestDuplicate(original,questions).q.id,'NUM-0002');
  assert.equal(bestDuplicate(original,questions,'NUM-0002').q,null);
});
test('registering an earlier batch item makes it visible to subsequent checks', ()=>{
  const questions=[];
  assert.equal(bestDuplicate(original,questions).q,null);
  questions.push(original);
  assert.ok(bestDuplicate({...original,id:undefined},questions).sim>=SIM_THRESHOLD);
});
