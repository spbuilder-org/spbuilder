import type { AmpParams, AmpTimeline, PageCondition, PageSettings, PoolChoice } from './ampTypes';
import { uid } from './uid';
import { getDisplayKey } from '../util/util';

export const choicePools = (choice: PoolChoice): number[] =>
  choice === 'empty' ? [] : Array.isArray(choice) ? choice : [choice];

export function defaultPage(timeline: AmpTimeline, index: number, keys: string[]): PageSettings {
  const last = index === (timeline.concurrentDisplays?.length ?? 1) - 1;
  return {
    id: `page-${uid()}`, name: '',
    response: { mode: last ? 'keyboard' : 'timeout', keys: [...keys],
      duration: timeline.durationsAndIntervals[index]?.[0] ?? 500,
      timeout: timeline.autoProceedTimeout, delayBefore: last ? timeline.delayBeforeKeyboard : 0,
      delayAfter: last ? timeline.delayAfterKeyboard : 0 },
    interval: timeline.durationsAndIntervals[index]?.[1] ?? 0,
  };
}

export function buildPageFlow(params: AmpParams) {
  const { timeline } = params;
  if (!timeline.concurrentDisplays || !timeline.pageSettings) return undefined;
  return { version: 1, sampling: 'uniform-pool', pages: timeline.pageSettings.map((page, i) => ({
    ...page,
    displays: timeline.concurrentDisplays![i].flatMap((row, r) => row.map((cell, c) => ({
      key: getDisplayKey(r, c), pools: [...new Set(choicePools(cell))],
    }))),
  })) };
}

/** Keep pool identity when a tab is removed or reordered. Removed references stay invalid. */
export function remapTimelinePools(timeline: AmpTimeline, map: (index: number) => number): AmpTimeline {
  function condition(node: PageCondition): PageCondition {
    if (node.type === 'group') return { ...node, children: node.children.map(condition) };
    return node.type === 'pool' ? { ...node, values: node.values.map(map) } : node;
  }
  return { ...timeline,
    concurrentDisplays: timeline.concurrentDisplays?.map(frame => frame.map(row => row.map(cell =>
      cell === 'empty' ? cell : Array.isArray(cell) ? cell.map(map) : map(cell)))),
    pageSettings: timeline.pageSettings?.map(p => ({ ...p, condition: p.condition && condition(p.condition) })),
  };
}

export function pageFlowErrors(params: AmpParams): string[] {
  const { timeline, stimuli } = params;
  if (!timeline.concurrentDisplays) return [];
  const errors: string[] = [];
  const pages = timeline.pageSettings;
  const validPool = (p: number) => Number.isInteger(p) && p >= 0 && p < stimuli.length;
  timeline.concurrentDisplays.forEach((frame, i) => frame.forEach((row, r) => row.forEach((cell, c) => {
    if (Array.isArray(cell) && !cell.length) errors.push(`Page ${i + 1}, ${getDisplayKey(r, c)}: select a pool or choose Blank.`);
    if (!choicePools(cell).every(validPool)) errors.push(`Page ${i + 1}, ${getDisplayKey(r, c)}: a source pool was removed.`);
  })));
  if (!pages) return errors;
  if (!pages.length || pages.length !== timeline.concurrentDisplays.length) errors.push('Page settings and displays must match.');
  if (new Set(pages.map(p => p.id)).size !== pages.length || pages.some(p => !p.id)) errors.push('Page IDs must be unique.');
  stimuli.forEach((pool, i) => {
    if (pool.items.some(item => !Number.isInteger(item.count) || item.count < 0)) errors.push(`Pool ${i + 1}: counts must be nonnegative integers.`);
  });
  if (!Number.isInteger(params.totalTrials) || params.totalTrials < 1 || !Number.isInteger(params.totalRounds) || params.totalRounds < 1) errors.push('Trials and rounds must be positive integers.');
  pages.forEach((page, i) => {
    const prefix = `Page ${i + 1}: `;
    const response = page.response;
    if (response.mode === 'keyboard' && !response.keys.length) errors.push(prefix + 'choose at least one response key.');
    if (![response.duration, response.delayBefore, response.delayAfter, page.interval].every(x => Number.isFinite(x) && x >= 0)) errors.push(prefix + 'timings must be nonnegative numbers.');
    if (response.timeout !== null && (!Number.isFinite(response.timeout) || response.timeout < response.delayBefore)) errors.push(prefix + 'timeout must be at least the keyboard delay.');
    function check(node: PageCondition) {
      if (node.type === 'group') {
        if (!node.children.length) errors.push(prefix + 'condition groups cannot be empty.');
        node.children.forEach(check); return;
      }
      const refIndex = pages!.findIndex(p => p.id === node.pageId);
      if (refIndex < 0 || refIndex >= i) { errors.push(prefix + 'conditions must reference an existing earlier page.'); return; }
      if (!node.values.length) errors.push(prefix + 'choose at least one condition value.');
      if (node.type === 'pool') {
        if (!node.values.every(validPool)) errors.push(prefix + 'a condition pool was removed.');
        const frame = timeline.concurrentDisplays![refIndex];
        if (!frame.some((row, r) => row.some((_, c) => getDisplayKey(r, c) === node.position))) errors.push(prefix + 'the referenced position no longer exists.');
      } else {
        const source = pages![refIndex].response;
        const allowed = [...(source.mode === 'keyboard' ? source.keys : []), ...(source.mode === 'timeout' || source.timeout !== null ? ['TIMEOUT'] : [])];
        if (!node.values.every(v => allowed.includes(v))) errors.push(prefix + 'a condition response is no longer available on its source page.');
      }
    }
    if (page.condition) check(page.condition);
  });
  return [...new Set(errors)];
}
