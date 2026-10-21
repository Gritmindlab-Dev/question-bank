import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeUsage,mergePatches,contentDifferences} from './duplicate-merge.mjs';
test('merge preserves distinct usage and removes identical institution/date/grade entries',()=>{
  const a={institution:'학교',when:'2026',grade:'3'};
  assert.deepEqual(mergeUsage([a],[{...a,institution:' 학교 '},{...a,when:'2025'},{}]),[a,{...a,when:'2025'}]);
});
test('merge leaves both original contents intact and archives the redundant question',()=>{
  const keep={id:'COM-0001',stem:'유지',images:['a'],choices:['1'],usageLog:[]};
  const drop={id:'COM-0002',stem:'원문',images:['b'],usageLog:[{institution:'학교'}]};
  const patch=mergePatches(keep,drop,'token',123);
  assert.equal(patch.drop.deleted,true);
  assert.equal(patch.drop.mergedInto,keep.id);
  assert.equal(patch.drop.mergeToken,'token');
  assert.equal({...drop,...patch.drop}.stem,'원문');
  assert.deepEqual({...keep,...patch.keep}.images,['a']);
  assert.equal(patch.keep.usageLog.length,1);
  assert.equal(drop.deleted,undefined);
});
test('stale overlapping candidates and self merge are rejected',()=>{
  assert.throws(()=>mergePatches({id:'a'},{id:'a'},'t',1));
  assert.throws(()=>mergePatches({id:'a'},{id:'b',deleted:true},'t',1));
  assert.throws(()=>mergePatches({id:'a',deleted:true},{id:'b'},'t',1));
});
test('differences include answers, images and structured materials',()=>{
  assert.deepEqual(contentDifferences({stem:'a',answer:'1',images:['a'],dataBlocks:[{raw:'a'}]},{stem:'a',answer:'2',images:['b'],dataBlocks:[{raw:'b'}]}),['정답','이미지','표/그래프']);
});
