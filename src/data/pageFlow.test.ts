import { emptyAmpParams } from './emptyAmpParams';
import { buildPageFlow, defaultPage, pageFlowErrors, remapTimelinePools } from './pageFlow';
import { hydrateQsf } from './generate';
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
  expect(JSON.parse(ed(concurrent, 'timeline').Value).pageFlow.sampling).toBe('uniform-pool');
  expect(ed(concurrent, 'sptPageDataVersion').Value).toBe('1');
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
  expect(buildPageFlow(restored)?.pages[0].displays[0].pools).toEqual([0, 1]);
  expect(buildPageFlow(restored)?.pages[1].condition).toEqual(tree);
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
