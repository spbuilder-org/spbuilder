import { emptyAmpParams } from './emptyAmpParams';
import { buildAdvancedTimeline, defaultPage, pageFlowErrors, remapTimelinePools } from './pageFlow';
import { hydrateQsf, generateQsfString } from './generate';
import type { AmpParams, PageCondition } from './ampTypes';

function params(): AmpParams {
  const p: AmpParams = JSON.parse(JSON.stringify(emptyAmpParams));
  p.timeline.concurrentDisplays = [[[[0, 1]]], [[0]]];
  p.timeline.pageSettings = [0, 1].map(i => defaultPage(p.timeline, i, p.acceptedKeys));
  return p;
}
const ed = (qsf: ReturnType<typeof hydrateQsf>, name: string) => {
  const flow = qsf.SurveyElements.find((e: any) => e.Element === 'FL') as any;
  return flow.Payload.Flow[0].EmbeddedData.find((e: any) => e.Field === name);
};
test('legacy export stays legacy and templates do not retain prior page-flow data', () => {
  const legacy = JSON.parse(JSON.stringify(emptyAmpParams));
  const before = JSON.stringify(hydrateQsf(legacy));
  const concurrent = hydrateQsf(params());
  expect(JSON.parse(ed(concurrent, 'timeline').Value).advanced).toBe(true);
  expect(ed(concurrent, 'sptPageDataVersion')).toBeUndefined();
  expect(ed(concurrent, 'sptPageResults')).toBeUndefined();
  expect(ed(concurrent, 'sptPoolSelectionArray').Type).toBe('Recipient');
  expect(ed(concurrent, 'sptDisplayedPages').Type).toBe('Recipient');
  expect(JSON.stringify(hydrateQsf(legacy))).toBe(before);
});
test('export preserves recursive condition and selected sources through settings JSON', () => {
  const p = params();
  const sourceId = p.timeline.pageSettings![0].id;
  const tree: PageCondition = { type: 'group', operator: 'or', children: [
    { type: 'group', operator: 'and', children: [{ type: 'pool', pageId: sourceId, position: 'A1', operator: 'eq', values: [0] }] },
    { type: 'pool', pageId: sourceId, position: 'A1', operator: 'eq', values: [1] },
  ] };
  p.timeline.pageSettings![1].condition = tree;
  const restored = JSON.parse(JSON.stringify(p));
  expect(pageFlowErrors(restored)).toEqual([]);
  expect(buildAdvancedTimeline(restored)?.pages[0].displays.A1).toEqual(['pool', [1, 2]]);
  expect(buildAdvancedTimeline(restored)?.pages[1].condition).toEqual(['or',
    ['and', ['poolSelection', 1, 'A1', '==', [1]]],
    ['poolSelection', 1, 'A1', '==', [2]],
  ]);
});
test('invalid or forward references and empty groups cannot be exported', () => {
  const p = params();
  p.timeline.pageSettings![0].condition = { type: 'response', pageId: p.timeline.pageSettings![1].id, operator: 'eq', values: ['d'] };
  expect(() => hydrateQsf(p)).toThrow('earlier page');
  p.timeline.pageSettings![0].condition = { type: 'group', operator: 'and', children: [] };
  expect(() => hydrateQsf(p)).toThrow('cannot be empty');
});
test('pool reorder preserves references and deletion invalidates without retargeting', () => {
  const p = params();
  p.timeline.pageSettings![1].condition = { type: 'pool', pageId: p.timeline.pageSettings![0].id, position: 'A1', operator: 'eq', values: [0] };
  const reordered = remapTimelinePools(p.timeline, i => 1 - i);
  expect(reordered.concurrentDisplays![0][0][0]).toEqual([1,0]);
  expect((reordered.pageSettings![1].condition as any).values).toEqual([1]);
  p.timeline = remapTimelinePools(p.timeline, i => i === 0 ? -1 : i - 1);
  p.stimuli.splice(0,1);
  expect(pageFlowErrors(p).join(' ')).toContain('removed');
});

test('advanced ED uses Stimulize responses and one-based references without selected outputs', () => {
  const p = params();
  const page = p.timeline.pageSettings![0];
  page.response = {mode:'keyboard', keys:['d','k'], delayBefore:100, delayAfter:50, timeout:3000, duration:0};
  p.timeline.pageSettings![1].condition = { type:'response', pageId:page.id, operator:'neq', values:['d'] };
  const qsf=hydrateQsf(p);
  const timeline=JSON.parse(ed(qsf,'timeline').Value);
  expect(timeline.pageFlow).toBeUndefined();
  expect(timeline.pages[0].response).toEqual({keyboard:{keys:['d','k'],delayBefore:100,delayAfter:50},timeout:{duration:3000}});
  expect(timeline.pages[1].condition).toEqual(['response',1,'!=',['d']]);
  expect(ed(qsf,'selectedOutputs')).toBeUndefined();
  expect(ed(qsf,'stimuliItem_1_A1')).toBeUndefined();
  expect(ed(qsf,'stimuliItem_2_A1')).toBeUndefined();
  expect(ed(qsf,'sptResponsesUnreversedArray').Type).toBe('Recipient');
  p.timeline.concurrentDisplays![1][0][0]='empty';
  expect(ed(hydrateQsf(p),'stimuliItem_2_A1')).toBeUndefined();
});
test('new-schema download requires a compatible manually exported runtime template', () => {
  // This expectation follows the actual installed template, including after manual refresh.
  const qsf=hydrateQsf(params());
  const load=(qsf.SurveyElements.find(e => e.PrimaryAttribute==='QID1')!.Payload as any).QuestionJS;
  const trial=(qsf.SurveyElements.find(e => e.PrimaryAttribute==='QID2')!.Payload as any).QuestionJS;
  if (load.includes('transformAdvancedTimeline') && trial.includes('sptPoolSelectionArray')) {
    expect(() => generateQsfString(params())).not.toThrow();
  } else {
    expect(() => generateQsfString(params())).toThrow('template needs the updated');
  }
  expect(() => generateQsfString(JSON.parse(JSON.stringify(emptyAmpParams)))).not.toThrow();
});

test('manual template refresh cannot reintroduce obsolete or deferred ED in either mode', () => {
  const template = require('../assets/qsfTemplate.json');
  const flow = template.SurveyElements.find((e: any) => e.Element === 'FL').Payload.Flow;
  const saved = JSON.stringify(flow);
  try {
    flow[0].EmbeddedData.push(
      {Field:'selectedOutputs', Type:'Custom', Value:'[{"type":"stimuliItem","page":9}]'},
      {Field:'stimuliItem_9_A1', Type:'Recipient'},
      {Field:'sptPageDataVersion', Type:'Custom', Value:'1'},
    );
    flow.push({Type:'Branch', Flow:[{Type:'EmbeddedData', EmbeddedData:[
      {Field:'sptPageResults', Type:'Recipient'},
      {Field:'stimuliItem_2_B3', Type:'Recipient'},
      {Field:'researcherNote', Type:'Custom', Value:'keep'},
    ]}]});
    const fields = (nodes: any[]): any[] => nodes.flatMap(n => [...(n.EmbeddedData ?? []), ...fields(n.Flow ?? [])]);
    for (const input of [JSON.parse(JSON.stringify(emptyAmpParams)), params()]) {
      const qsf=hydrateQsf(input);
      const nodes=(qsf.SurveyElements.find((e:any)=>e.Element==='FL')!.Payload as any).Flow;
      expect(fields(nodes).some((e:any)=>['sptPageDataVersion','sptPageResults','selectedOutputs'].includes(e.Field) || e.Field.startsWith('stimuliItem_'))).toBe(false);
      expect(fields(nodes).find((e:any)=>e.Field==='researcherNote').Value).toBe('keep');
    }
  } finally { flow.splice(0,flow.length,...JSON.parse(saved)); }
});
