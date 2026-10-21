import type { AmpParams, AmpTimeline } from './ampTypes';
import { defaultPage } from './pageFlow';

export type TimelineMode = 'simple' | 'concurrent' | 'concurrent+conditional';

// Infer mode from existing settings so saved files need no new schema field.
export function timelineMode(timeline: AmpTimeline): TimelineMode {
  if (!timeline.concurrentDisplays) return 'simple';
  return timeline.pageSettings ? 'concurrent+conditional' : 'concurrent';
}

/** The UI confirms a downgrade before calling this conversion. */
export function changeTimelineMode(params: AmpParams, mode: TimelineMode): Pick<AmpParams, 'timeline' | 'acceptedKeys'> {
  let timeline = { ...params.timeline };
  let acceptedKeys = [...params.acceptedKeys];
  if (mode === timelineMode(timeline)) return { timeline, acceptedKeys };

  if (mode === 'concurrent+conditional') {
    timeline.concurrentDisplays ??= params.stimuli.map((_, i) => [[i]]);
    timeline.pageSettings = timeline.concurrentDisplays.map((_, i) => defaultPage(timeline, i, acceptedKeys));
    return { timeline, acceptedKeys };
  }

  if (timeline.pageSettings?.length) {
    const pages = timeline.pageSettings;
    const last = pages[pages.length - 1].response;
    timeline.durationsAndIntervals = pages.slice(0, -1).map(page => [page.response.duration, page.interval]);
    timeline.delayBeforeKeyboard = last.mode === 'keyboard' ? last.delayBefore : 0;
    timeline.delayAfterKeyboard = last.mode === 'keyboard' ? last.delayAfter : 0;
    timeline.autoProceedTimeout = last.mode === 'keyboard' ? last.timeout : last.duration;
    acceptedKeys = last.keys.length ? [...last.keys] : acceptedKeys;
    timeline.concurrentDisplays = timeline.concurrentDisplays?.map(frame => frame.map(row => row.map(cell =>
      Array.isArray(cell) ? cell[0] ?? 'empty' : cell)));
  }
  timeline.pageSettings = undefined;
  if (mode === 'simple') {
    timeline.concurrentDisplays = undefined;
    timeline.durationsAndIntervals = Array.from({ length: Math.max(0, params.stimuli.length - 1) },
      (_, i) => timeline.durationsAndIntervals[i] ?? [100, 0]);
  } else {
    timeline.concurrentDisplays ??= params.stimuli.map((_, i) => [[i]]);
  }
  return { timeline, acceptedKeys };
}
