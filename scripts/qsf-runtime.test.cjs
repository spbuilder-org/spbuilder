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
const params=JSON.parse(JSON.stringify(emptyAmpParams));
params.stimuli=[['insect',1],['flower',1],['error',2]].map(([content,count],i)=>({items:[{uid:i+100,type:'text',content,count}],shuffle:false,isEnablePriming:false,prime:[]}));
params.totalTrials=2;params.totalRounds=2;
params.timeline.concurrentDisplays=[[[[0,1]]],[[2]]];
const response={mode:'keyboard',keys:['d','k'],duration:20,timeout:null,delayBefore:0,delayAfter:0};
const pair=(pool,key)=>({type:'group',operator:'and',children:[
  {type:'pool',pageId:'stimulus',position:'A1',operator:'eq',values:[pool]},
  {type:'response',pageId:'stimulus',operator:'neq',values:[key]},
]});
params.timeline.pageSettings=[{id:'stimulus',name:'Categorize',response,interval:0},{id:'feedback',name:'Error',response:{...response,mode:'timeout'},interval:0,condition:{type:'group',operator:'or',children:[pair(0,'d'),pair(1,'k')]}}];
const qsf=hydrateQsf(params);
function setup(qsfData) {
 const dom=new JSDOM('<div id="question"></div>',{runScripts:'outside-only',url:'https://survey.test'});
 const w=dom.window;let callbacks=[];let unload=[];let next=0;let id=0;const tasks=new Map();
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
test('actual generated QSF runs nested feedback for two trials and independently resets both rounds',()=>{
 const env=setup(qsf);env.execute('QID1');
 for(let round=0;round<2;round++){
  env.execute('QID2');env.flush();assert.match(env.api.questionContainer.textContent,/insect/);
  env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:round===0?'k':'d'}));env.flush();
  assert.match(env.api.questionContainer.textContent,/flower/);
  env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'k'}));env.flush();env.unload();
 }
 assert.equal(env.next(),2);
 const results=JSON.parse(env.data.sptPageResults);
 assert.equal(results[0][0].feedback.status,'completed');
 assert.equal(results[0][1].feedback.status,'skipped');
 assert.equal(results[1][0].feedback.status,'skipped');
 assert.equal(results[1][0].stimulus.draws.A1.pool,1);
 assert.equal(env.data.sptResponses,'k,k;d,k');
 env.close();
});
test('legacy exported QSF still displays its first one-count pool and records a trial response',()=>{
 const p=JSON.parse(JSON.stringify(emptyAmpParams));p.stimuli=p.stimuli.slice(0,1);p.stimuli[0].items[0].content='legacy';
 p.timeline.durationsAndIntervals=[];
 const env=setup(hydrateQsf(p));env.execute('QID1');env.execute('QID2');env.flush();
 assert.match(env.api.questionContainer.textContent,/legacy/);
 env.w.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'d'}));env.flush();
 assert.equal(env.data.sptResponses,'d');assert.equal(env.next(),1);env.close();
});
if(process.env.STML29_WRITE_FIXTURE){
 fs.mkdirSync('output/playwright',{recursive:true});
 fs.writeFileSync('output/playwright/insect-flower-settings.json',JSON.stringify({values:params},null,2));
 fs.writeFileSync('output/playwright/insect-flower.qsf',JSON.stringify(qsf));
}
