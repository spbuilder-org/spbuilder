const { emptyAmpParams } = require('../src/data/emptyAmpParams.ts');
const params=JSON.parse(JSON.stringify(emptyAmpParams));
params.stimuli=[['insect',1],['flower',1],['error',2]].map(([content,count],i)=>({items:[{uid:i+100,type:'text',content,count}],shuffle:false,isEnablePriming:false,prime:[]}));
params.totalTrials=2;params.totalRounds=2;
params.timeline.concurrentDisplays=[[[[0,1]]],[[2]]];
const response={mode:'keyboard',keys:['d','k'],duration:500,timeout:null,delayBefore:0,delayAfter:0};
const pair=(pool,key)=>({type:'group',operator:'and',children:[
  {type:'pool',pageId:'stimulus',position:'A1',operator:'eq',values:[pool]},
  {type:'response',pageId:'stimulus',operator:'neq',values:[key]},
]});
params.timeline.pageSettings=[{id:'stimulus',name:'Categorize',response,interval:0},{id:'feedback',name:'Error',response:{...response,mode:'timeout'},interval:0,condition:{type:'group',operator:'or',children:[pair(0,'d'),pair(1,'k')]}}];

module.exports = params;
