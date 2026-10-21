const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop:true },
}).outputText, file);
const { hydrateQsf } = require('../src/data/generate.ts');
const { emptyAmpParams } = require('../src/data/emptyAmpParams.ts');
const path = require('node:path');
const params = require('./insect-flower-fixture.cjs');
const runtimeRoot = process.env.AMP_QUALTRICS_SOURCE;
function runtimeQsf(p) {
  const qsf = hydrateQsf(p);
  if (runtimeRoot) {
    // Test-only substitution in memory. Never edits or exports the committed QSF template.
    for (const [id, file] of [['QID1','load.js'],['QID2','trial.js']]) {
      qsf.SurveyElements.find(e=>e.PrimaryAttribute===id).Payload.QuestionJS =
        fs.readFileSync(path.resolve(runtimeRoot, 'src', file), 'utf8');
    }
  }
  return qsf;
}
const qsf=runtimeQsf(params);
const load=qsf.SurveyElements.find(e=>e.PrimaryAttribute==='QID1').Payload.QuestionJS;
const trial=qsf.SurveyElements.find(e=>e.PrimaryAttribute==='QID2').Payload.QuestionJS;
const advancedAvailable=load.includes('transformAdvancedTimeline') && trial.includes('sptPoolSelectionArray');
const advancedTest=(name,fn)=>test(name,{skip:advancedAvailable?false:'Imported QSF needs manual Qualtrics refresh. Set AMP_QUALTRICS_SOURCE to test the new source.'},fn);
function setup(qsfData, legacyArrayFrom = false) {
 const dom=new JSDOM('<div id="question"></div>',{runScripts:'outside-only',url:'https://survey.test'});
 const w=dom.window;let callbacks=[];let unload=[];let next=0;let id=0;const tasks=new Map();
 if (legacyArrayFrom) w.eval(`Array.from = function(iterable) {
   if (!iterable) return [];
   var length = iterable.length || 0, result = new Array(length);
   while (length--) result[length] = iterable[length];
   return result;
 };`);
 const data=Object.fromEntries(qsfData.SurveyElements.find(e=>e.Element==='FL').Payload.Flow[0].EmbeddedData.map(e=>[e.Field,e.Value??null]));
 w.console={log(){},debug(){},warn(){},error(){}};w.Math.random=()=>0;
 w.setTimeout=(fn,ms)=>{tasks.set(++id,{fn,ms});return id;};w.clearTimeout=id=>tasks.delete(id);
 w.Qualtrics={SurveyEngine:{getEmbeddedData:name=>data[name]??null,setEmbeddedData:(name,value)=>data[name]=value,addOnload:fn=>callbacks.push(fn),addOnUnload:fn=>unload.push(fn)}};
 const api={questionContainer:w.document.getElementById('question'),hideNextButton(){},hidePreviousButton(){},hideChoices(){},clickNextButton(){next++;}};
 const execute=id=>{
  const q=qsfData.SurveyElements.find(e=>e.PrimaryAttribute===id).Payload;
  api.questionContainer.innerHTML=q.QuestionText;
  callbacks=[];w.eval('(function(){'+q.QuestionJS+'\n})()');callbacks.forEach(fn=>fn.call(api));
 };
 const flush=()=>{let n=0;while(tasks.size){if(++n>200)throw Error('timer loop');const [id,job]=tasks.entries().next().value;tasks.delete(id);job.fn();}};
 return {w,data,api,execute,flush,next:()=>next,unload:()=>{unload.forEach(fn=>fn.call(api));unload=[];},close:()=>dom.window.close()};
}
advancedTest('generated ED + runtime run nested feedback for two trials and independently reset both rounds',()=>{
 const env=setup(qsf);env.execute('QID1');
 assert.equal('selectedOutputs' in env.data,false);
 assert.equal('selectedOutputs' in env.w.params,false);
 for(let round=0;round<2;round++){
  env.execute('QID2');env.flush();assert.match(env.api.questionContainer.textContent,/insect/);
  env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:round===0?'k':'d'}));env.flush();
  assert.match(env.api.questionContainer.textContent,/flower/);
  env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'k'}));env.flush();env.unload();
 }
 assert.equal(env.next(),2);
 const results=JSON.parse(env.data.sptResponsesArray);
 assert.deepEqual(results,[[['k','TIMEOUT'],['k',null]],[['d',null],['k',null]]]);
 assert.equal(env.data.sptResponses,'k/TIMEOUT,k/;d/,k/');
 assert.equal(env.data.sptResponsesUnreversedArray,env.data.sptResponsesArray);
 assert.equal(Object.keys(env.data).some(name=>name.startsWith('stimuliItem_')),false);
 assert.equal(env.data.sptDisplayedPages,'1/2,1;1,1');
 assert.deepEqual(JSON.parse(env.data.sptPoolSelectionArray),[[[{A1:1},{A1:3}],[{A1:2},{}]],[[{A1:1},{}],[{A1:2},{}]]]);
 assert.equal('sptPageResults' in env.data,false);
 assert.equal('sptPageDataVersion' in env.data,false);
 env.close();
});
test('legacy exported QSF still displays its first one-count pool and records a trial response',()=>{
 const p=JSON.parse(JSON.stringify(emptyAmpParams));p.stimuli=p.stimuli.slice(0,1);p.stimuli[0].items[0].content='legacy';
 p.timeline.durationsAndIntervals=[];
 const env=setup(runtimeQsf(p));env.execute('QID1');env.execute('QID2');env.flush();
 assert.match(env.api.questionContainer.textContent,/legacy/);
 env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'d'}));env.flush();
 assert.equal(env.data.sptResponses,'d');assert.equal(env.next(),1);env.close();
});
advancedTest('array-like-only host Array.from still renders stimuli, advances trials and exports feedback',()=>{
 const p=JSON.parse(JSON.stringify(params));p.totalRounds=1;
 const env=setup(runtimeQsf(p),true);env.execute('QID1');env.execute('QID2');env.flush();
 assert.match(env.api.questionContainer.textContent,/insect/);
 env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'k'}));env.flush();
 assert.match(env.api.questionContainer.textContent,/flower/);
 env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'k'}));env.flush();
 assert.deepEqual(JSON.parse(env.data.sptResponsesArray),[[['k','TIMEOUT'],['k',null]]]);
 assert.deepEqual(JSON.parse(env.data.sptPoolSelectionArray),[[[{A1:1},{A1:3}],[{A1:2},{}]]]);
 assert.equal(env.data.sptDisplayedPages,'1/2,1');
 assert.equal(env.next(),1);env.close();
});
advancedTest('later trials use their own nested conditions; exhaustion never becomes pool 1',()=>{
 const p=JSON.parse(JSON.stringify(params));p.totalTrials=3;p.totalRounds=1;
 const env=setup(runtimeQsf(p));env.execute('QID1');env.execute('QID2');env.flush();
 for(const key of ['d','d','k']) {
  env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key}));env.flush();
 }
 assert.deepEqual(JSON.parse(env.data.sptResponsesArray),[[['d',null],['d','TIMEOUT'],['k',null]]]);
 assert.deepEqual(JSON.parse(env.data.sptPoolSelectionArray),[[[{A1:1},{}],[{A1:2},{A1:3}],[{A1:null},{}]]]);
 assert.equal(env.data.sptDisplayedPages,'1,1/2,1');env.close();
});
advancedTest('timeout and blank positions use the shared result contract',()=>{
 const p=JSON.parse(JSON.stringify(params));p.totalTrials=1;p.totalRounds=1;
 p.timeline.concurrentDisplays[0][0].push('empty');
 p.timeline.pageSettings[0].response.timeout=10;
 const env=setup(runtimeQsf(p));env.execute('QID1');env.execute('QID2');env.flush();
 assert.deepEqual(JSON.parse(env.data.sptResponsesArray),[[['TIMEOUT','TIMEOUT']]]);
 assert.deepEqual(JSON.parse(env.data.sptResponseDurationsArray),[[[null,null]]]);
 assert.equal(env.data.sptResponsesUnreversedArray,env.data.sptResponsesArray);
 assert.deepEqual(JSON.parse(env.data.sptPoolSelectionArray),[[[{A1:1},{A1:3}]]]);
 assert.equal(env.next(),1);env.close();
});
test('reviewable insect/flower ED example matches the real generator',()=>{
 const expected=require('../examples/insect-flower.input-ed.json');
 const data=Object.fromEntries(hydrateQsf(params).SurveyElements.find(e=>e.Element==='FL').Payload.Flow[0].EmbeddedData
   .filter(e=>e.Value!==undefined).map(e=>[e.Field,e.Value]));
 assert.deepEqual(data,expected);
});
if(process.env.STML29_WRITE_FIXTURE){
 fs.mkdirSync('output/playwright',{recursive:true});
 fs.writeFileSync('output/playwright/insect-flower-settings.json',JSON.stringify({values:params},null,2));
}

test('the same input ED is accepted by the Stimulize loader', {
 skip:process.env.STIMULIZE_QSF_PATH ? false : 'Set STIMULIZE_QSF_PATH for the cross-project loader check.',
},()=>{
 const stimulize=JSON.parse(fs.readFileSync(process.env.STIMULIZE_QSF_PATH,'utf8'));
 const shared=hydrateQsf(params);
 shared.SurveyElements.find(e=>e.PrimaryAttribute==='QID1').Payload.QuestionJS=
   stimulize.SurveyElements.find(e=>e.PrimaryAttribute==='QID1').Payload.QuestionJS;
 const reference=setup(shared);reference.execute('QID1');
 const local=setup(runtimeQsf(params));local.execute('QID1');
 const parsed=w=>JSON.parse(JSON.stringify(w.params));
 // Stimulize stores state in its named survey namespace.
 const referenceState=reference.w.sptStates;
 const actual=parsed(local.w);
 const expected=parsed(referenceState);
 assert.deepEqual(actual.rounds.map(r=>r.advancedTimeline.pages),expected.rounds.map(r=>r.advancedTimeline.pages));
 assert.equal('selectedOutputs' in actual,false);
 reference.close();local.close();
});

test('normal-case output matches the existing Stimulize serializer byte for byte', {
 skip:process.env.STIMULIZE_QSF_PATH && runtimeRoot ? false : 'Set both source paths for the cross-project output check.',
},()=>{
 const vm=require('node:vm');
 const template=JSON.parse(fs.readFileSync(process.env.STIMULIZE_QSF_PATH,'utf8'));
 const referenceSource=template.SurveyElements.find(e=>e.PrimaryAttribute==='QID2').Payload.QuestionJS;
 function definition(source,name) {
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  return source.slice(start,source.indexOf('\n}',start)+2);
 }
 const records=[[
  [{status:'completed',response:'d',duration:123.8,draws:{A1:{status:'drawn',poolIndex:0,itemIndex:2}}}],
  [{status:'completed',response:'k',duration:456.2,draws:{A1:{status:'drawn',poolIndex:1,itemIndex:3}}}],
 ]];
 // Compare the supported subset with optional selected outputs disabled in Stimulize.
 const states={params:{selectedOutputs:[]},responses:[[['d'],['k']]],responsesUnreversed:[[['d'],['k']]],
  responseDurations:[[[123.8],[456.2]]],advancedTimelinePoolSelection:[[[{A1:0}],[{A1:1}]]],
  advancedTimelineDisplayedPages:[[[true],[true]]],advancedTimelineDisplayHistory:records.map(r=>r.map(t=>t.map(p=>p.draws))),
 };
 const expected={};
 const ref=vm.createContext({states,_set:(key,value)=>expected[key]=value});
 for(const name of ['mergeSparse3D','mapObject','exportResponse']) vm.runInContext(definition(referenceSource,name),ref);
 ref.exportResponse();
 const local=vm.createContext({});
 vm.runInContext(definition(trial,'exportAdvancedResults'),local);
 const actual=local.exportAdvancedResults([{totalTrials:2,advancedTimeline:{pages:[{}]}}],records);
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
});
