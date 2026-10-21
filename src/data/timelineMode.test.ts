import { emptyAmpParams } from './emptyAmpParams';
import { buildAdvancedTimeline } from './pageFlow';
import { changeTimelineMode, timelineMode } from './timelineMode';
import { hydrateQsf } from './generate';
import type { AmpParams } from './ampTypes';

const fresh = (): AmpParams => JSON.parse(JSON.stringify(emptyAmpParams));
const exportedTimeline = (p: AmpParams) => {
  const qsf = hydrateQsf(p);
  const flow = qsf.SurveyElements.find(e => e.Element === 'FL')!.Payload as any;
  return JSON.parse(flow.Flow[0].EmbeddedData.find((ed: any) => ed.Field === 'timeline').Value);
};

test('simple and concurrent retain legacy timing and export, including after a settings round trip', () => {
  const p = fresh();
  expect(timelineMode(p.timeline)).toBe('simple');
  Object.assign(p, changeTimelineMode(p, 'concurrent'));
  expect(timelineMode(JSON.parse(JSON.stringify(p.timeline)))).toBe('concurrent');
  expect(p.timeline.concurrentDisplays).toEqual([[[0]], [[1]]]);
  expect(p.timeline.pageSettings).toBeUndefined();
  expect(p.timeline.durationsAndIntervals).toEqual([[100, 125]]);
  expect(exportedTimeline(p).advanced).toBeUndefined();
  Object.assign(p, changeTimelineMode(p, 'simple'));
  expect(p).toEqual(emptyAmpParams);
});

test('upgrading concurrent preserves its layout, timing and final keyboard settings', () => {
  const p = fresh();
  p.timeline.concurrentDisplays = [[[0, 1]], [['empty']]];
  p.timeline.delayBeforeKeyboard = 150;
  p.timeline.delayAfterKeyboard = 200;
  p.timeline.autoProceedTimeout = 2000;
  const before = JSON.stringify(p);
  const advanced = { ...p, ...changeTimelineMode(p, 'concurrent+conditional') };
  expect(JSON.stringify(p)).toBe(before);
  expect(timelineMode(advanced.timeline)).toBe('concurrent+conditional');
  expect(advanced.timeline.concurrentDisplays).toEqual(p.timeline.concurrentDisplays);
  expect(advanced.timeline.pageSettings![0]).toMatchObject({ interval: 125, response: { mode: 'timeout', duration: 100 } });
  expect(advanced.timeline.pageSettings![1].response).toMatchObject({ mode: 'keyboard', keys: ['d', 'k'], delayBefore: 150, delayAfter: 200, timeout: 2000 });
  expect(buildAdvancedTimeline(advanced)!.pages[0].displays).toEqual({ A1: ['pool', [1]], A2: ['pool', [2]] });
  expect(exportedTimeline(advanced).advanced).toBe(true);
});

test('confirmed downgrade removes conditional settings and converts pool arrays into legacy choices', () => {
  const p = fresh();
  Object.assign(p, changeTimelineMode(p, 'concurrent+conditional'));
  p.timeline.concurrentDisplays![0][0][0] = [1, 0];
  p.timeline.pageSettings![0].response.duration = 300;
  p.timeline.pageSettings![0].interval = 75;
  p.timeline.pageSettings![1].response.keys = ['a'];
  p.timeline.pageSettings![1].condition = { type: 'pool', pageId: p.timeline.pageSettings![0].id, position: 'A1', operator: 'eq', values: [1] };
  Object.assign(p, changeTimelineMode(p, 'concurrent'));
  expect(p.timeline.pageSettings).toBeUndefined();
  expect(p.timeline.concurrentDisplays).toEqual([[[1]], [[1]]]);
  expect(p.timeline.durationsAndIntervals).toEqual([[300, 75]]);
  expect(p.acceptedKeys).toEqual(['a']);
  expect(exportedTimeline(p).advanced).toBeUndefined();
});
