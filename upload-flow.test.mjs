import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as duplicate from './duplicate-check.mjs';

function harness(){
  const elements = new Map();
  function element(id){
    if(!elements.has(id)) elements.set(id, {value:'',innerHTML:'',textContent:'',style:{},disabled:false,
      classList:{add(){},remove(){},toggle(){}}, addEventListener(type, fn){this[type]=fn;},
      querySelectorAll(){return [];},setAttribute(){},append(){},replaceChildren(){}});
    return elements.get(id);
  }
  const state={rows:[],writes:[],failRead:false,failWriteAt:0};
  const context=vm.createContext({...duplicate, console, window:{}, setTimeout(){}, alert(){},
    firebaseConfig:{},initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),onAuthStateChanged(){},
    collection:()=>({}),doc:(_db,_col,id)=>id,
    getDocsFromServer:async()=>{if(state.failRead) throw Error('offline'); return {docs:state.rows.map(q=>({id:q.id,data:()=>{const {id,...data}=q; return data;}}))};},
    setDoc:async(id,data)=>{if(state.failWriteAt && state.writes.length+1===state.failWriteAt) throw Error('write failed'); state.writes.push(data);state.rows.push(data);},
    document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:()=>element(Symbol())}
  });
  const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import[\s\S]*?from\s+"[^"]+";\n/gm,'');
  vm.runInContext(source,context);
  vm.runInContext('renderTable = ()=>{};',context);
  return {state,element,run:code=>vm.runInContext(code,context)};
}
const item={domain:'의사소통능력',stem:'다음 설명에서 조직의 의사소통 방법으로 가장 적절한 것은?',passage:'',choices:['상대방의 의견을 끝까지 듣는다','상대방의 말을 중간에 끊는다'],answer:'1',difficulty:'중'};
test('single upload refuses to write when the existing collection cannot load',async()=>{
  const h=harness(); h.state.failRead=true;h.element('f_stem').value=item.stem;
  await h.element('checkAndUpload').click();
  assert.equal(h.state.writes.length,0);
  assert.match(h.element('checkResult').textContent,/중단/);
  assert.equal(h.element('checkAndUpload').disabled,false);
});
test('batch rechecks server data added after preview, including documents without an id field',async()=>{
  const h=harness();h.state.rows=[{...item,id:'COM-0088'}];
  h.run('batchParsed = '+JSON.stringify([{...item,_dup:false}]));
  await h.element('registerAllOk').click();
  assert.equal(h.state.writes.length,0);
  assert.match(h.element('batchResult').innerHTML,/중복 의심 1개/);
});
test('batch duplicates are skipped even before live snapshot delivery',async()=>{
  const h=harness(); h.run('batchParsed = '+JSON.stringify([item,item]));
  await h.element('registerAllOk').click();
  assert.equal(h.state.writes.length,1);
});
test('retry after partial failure does not register completed entries twice',async()=>{
  const h=harness();h.state.failWriteAt=2;
  const other={...item,stem:'직렬 회로에 흐르는 전류의 크기는 얼마인가?',choices:['3암페어','8암페어']};
  h.run('batchParsed = '+JSON.stringify([item,other]));
  await h.element('registerAllOk').click();
  assert.equal(h.state.writes.length,1);
  h.state.failWriteAt=0;
  await h.element('registerAllOk').click();
  assert.equal(h.state.writes.length,2);
  assert.notEqual(h.state.writes[0].id,h.state.writes[1].id);
});
