const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ctx = vm.createContext({});
const template = require('../src/assets/qsfTemplate.json');
const source = template.SurveyElements.find(e => e.PrimaryAttribute === 'QID2').Payload.QuestionJS;
vm.runInContext(source.slice(0, source.indexOf('/**\n * @typedef')), ctx);
const { createPoolSampler, evaluatePageCondition, createPageFlowRunner, exportPageRecords } = ctx;
function pool(size, content) { return { shuffledIndexes: Array(size).fill(0), items: [{ type: 'text', content }] }; }
function clock() {
  let id = 0, time = 0; const jobs = new Map();
  return { now: () => time,
    setTimeout: (fn, ms) => { jobs.set(++id, { fn, at: time + ms }); return id; },
    clearTimeout: id => jobs.delete(id),
    advance: ms => { const end = time + ms; let n = 0; while (true) {
      const next = [...jobs].filter(([, j]) => j.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!next) break;
      if (++n > 1000) throw Error('timer loop');
      time = next[1].at; jobs.delete(next[0]); next[1].fn();
    } time = end; },
  };
}
const response = (mode = 'keyboard') => ({ mode, keys: ['d','k'], duration: 50, timeout: null, delayBefore: 0, delayAfter: 0 });
const leaf = (type, values, operator = 'eq') => ({ type, pageId: 'stimulus', position: 'A1', values, operator });
const errors = { type: 'group', operator: 'or', children: [
  { type: 'group', operator: 'and', children: [leaf('pool',[0]),leaf('response',['d'],'neq')] },
  { type: 'group', operator: 'and', children: [leaf('pool',[1]),leaf('response',['k'],'neq')] },
] };
test('pool choice is equal despite 1:30 capacity and consumption does not refill', () => {
  const usage = [];
  const draw = createPoolSampler([pool(1,'insect'), pool(30,'flower')], usage, () => .49);
  assert.equal(draw([0,1]).poolIndex, 0);
  for (let i=0;i<30;i++) assert.equal(draw([0,1]).poolIndex,1);
  assert.equal(draw([0,1]).status,'exhausted');
  assert.equal(draw([]).status,'blank');
  assert.deepEqual(usage,[1,30]);
});
test('duplicate pool references do not create extra weight; policy can be replaced', () => {
  const draw=createPoolSampler([pool(4,'a'),pool(20,'b')],[],()=>.4);
  assert.equal(draw([0,0,1]).poolIndex,0);
  const custom=createPoolSampler([pool(4,'a'),pool(20,'b')],[],()=>0,candidates=>candidates.at(-1).poolIndex);
  assert.equal(custom([0,1]).poolIndex,1);
});
test('nested correctness condition handles all four pool/response pairs and missing data', () => {
  for (const source of [0,1]) for (const key of ['d','k']) {
    const records={ stimulus: { status:'completed',response:key,draws:{A1:{status:'drawn',poolIndex:source}} }};
    assert.equal(evaluatePageCondition(errors,records),key !== ['d','k'][source]);
  }
  assert.equal(evaluatePageCondition(leaf('response',['d'],'neq'),{}),false);
  assert.equal(evaluatePageCondition(leaf('pool',[0],'neq'),{stimulus:{status:'completed',draws:{A1:{status:'exhausted'}}}}),false);
  assert.equal(evaluatePageCondition({type:'group',operator:'and',children:[]},{}),false);
});
function simulation(key) {
  const timer=clock(); let handler; let done=0; const shown=[]; const records=[]; const usage=[];
  const pages=[
    {id:'stimulus',displays:[{key:'A1',pools:[0,1]}],response:response(),interval:0},
    {id:'feedback',displays:[{key:'A1',pools:[2]}],condition:errors,response:response('timeout'),interval:0},
  ];
  const runner=createPageFlowRunner({...timer,pages,totalTrials:2,records,draw:createPoolSampler([pool(1,'insect'),pool(1,'flower'),pool(2,'error')],usage,()=>0),
    display:draws=>shown.push(draws.A1.content), clear:()=>{},listen:fn=>handler=fn,onTrial:()=>{},onDone:()=>done++});
  runner.start();timer.advance(0);handler(key);timer.advance(50);
  assert.equal(records[0].feedback.status,key==='d'?'skipped':'completed');
  handler('k');timer.advance(50);
  assert.equal(records[1].feedback.status,'skipped'); assert.equal(done,1);
  assert.equal(usage[2]||0,key==='d'?0:1);
  return {records,shown};
}
test('runner completes correct and incorrect trials, skipping feedback without consuming it',()=>{
  assert.deepEqual(simulation('d').shown,['insect','flower']);
  assert.deepEqual(simulation('k').shown,['insect','error','flower']);
});
test('timeout wins once and stop cancels future page draws',()=>{
  const timer=clock();let handler;let done=0;let draws=0;const records=[];
  const runner=createPageFlowRunner({...timer,pages:[{id:'stimulus',displays:[{key:'A1',pools:[0]}],response:{...response(),timeout:10},interval:0}],totalTrials:2,records,
    draw:()=>{draws++;return {status:'drawn',poolIndex:0,itemIndex:0};},display:()=>{},clear:()=>{},listen:fn=>handler=fn,onTrial:()=>{},onDone:()=>done++});
  runner.start();timer.advance(0);const stale=handler;timer.advance(10);stale('d');runner.stop();timer.advance(100);
  assert.equal(records[0].stimulus.response,'TIMEOUT');assert.equal(draws,2);assert.equal(done,0);
});
test('replaying cached trial records does not consume additional stimuli',()=>{
  const timer=clock();const records=simulation('d').records;let draws=0;
  const runner=createPageFlowRunner({...timer,pages:[{id:'stimulus',displays:[{key:'A1',pools:[0,1]}],response:response(),interval:0}],totalTrials:2,records,
    draw:()=>{draws++;},display:()=>{},clear:()=>{},listen:()=>{},onTrial:()=>{},onDone:()=>{}});
  runner.start();timer.advance(100);assert.equal(draws,0);
});
test('export uses one-based pool/item references with explicit skipped states',()=>{
  const records=simulation('k').records;const exported=exportPageRecords([records]);
  assert.equal(exported[0][0].stimulus.draws.A1.pool,1);
  assert.equal(exported[0][1].stimulus.draws.A1.pool,2);
  assert.equal(exported[0][1].feedback.status,'skipped');
  assert.equal('content' in exported[0][0].stimulus.draws.A1,false);
});
