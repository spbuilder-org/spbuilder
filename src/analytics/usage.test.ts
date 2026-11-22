import type { CaptureResult } from 'posthog-js';
import { emptyAmpParams } from '../data/emptyAmpParams';
import { changeTimelineMode } from '../data/timelineMode';

jest.mock('posthog-js/dist/module.slim.no-external', () => ({
  __esModule: true,
  default: {
    init: jest.fn(), capture: jest.fn(), get_session_id: () => 'session-one',
    has_opted_out_capturing: () => false, opt_out_capturing: jest.fn(),
  },
}));

test('consent gates collection and only approved properties reach PostHog', () => {
  process.env.REACT_APP_POSTHOG_PROJECT_TOKEN = 'phc_test';
  process.env.REACT_APP_POSTHOG_REGION = 'us';
  window.history.replaceState({}, '', '/?private=CONTENT#/data-analysis?utm_campaign=workshop');
  const uuid = jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000001');
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: uuid } });
  let now = 0;
  const clock = jest.spyOn(performance, 'now').mockImplementation(() => now);
  const focus = jest.spyOn(document, 'hasFocus').mockReturnValue(true);
  const usage: typeof import('./usage') = require('./usage');
  const sdk = require('posthog-js/dist/module.slim.no-external').default;
  const wire: CaptureResult[] = [];
  sdk.capture.mockImplementation((event: string, metadata: Record<string, unknown>) => {
    const payload = sdk.init.mock.calls[0][1].before_send({
      event, uuid: uuid(), $set: { experiment: 'CONTENT' }, $set_once: { first: 'CONTENT' },
      properties: { distinct_id: 'anonymous', $current_url: window.location.href,
        $session_entry_url: 'CONTENT', $referrer: 'CONTENT', $elements: ['CONTENT'], ...metadata },
    });
    if (payload) wire.push(payload);
  });

  try {
    usage.setPage('/');
    usage.syncUsage();
    usage.saveConsent('decline');
    usage.recordAction('settings_imported');
    expect(sdk.init).not.toHaveBeenCalled();
    usage.saveConsent('allow');
    usage.setPage('/');
    usage.recordAction('example_loaded');
    expect(wire.map(e => e.event)).toEqual(['$pageview', 'example_loaded']);
    usage.editingStarted();
    usage.editingStarted();
    expect(wire.filter(e => e.event === 'editing_started')).toHaveLength(1);

    const advanced = changeTimelineMode(emptyAmpParams, 'concurrent+conditional');
    advanced.timeline.concurrentDisplays![0] = [[[0, 1]]];
    advanced.timeline.pageSettings![1].condition = { type: 'response', pageId: 'CONTENT', operator: 'eq', values: ['CONTENT'] };
    usage.recordQsfDownload({ ...emptyAmpParams, ...advanced }, 'imported');
    expect(wire[wire.length - 1].properties).toMatchObject({
      started_from: 'imported', mode: 'concurrent+conditional', has_condition: true, has_multi_pool: true,
      page_count: 2, pool_count: 2, round_count: 1, utm_campaign: 'workshop',
    });
    now = 1000;
    focus.mockReturnValue(false);
    window.dispatchEvent(new Event('blur'));
    now += 600000;
    focus.mockReturnValue(true);
    window.dispatchEvent(new Event('focus'));
    now += 2000;
    usage.setPage('/data-analysis');
    expect(wire.find(e => e.event === 'page_engagement')?.properties.engagement_ms).toBe(3000);
    expect(wire.find(e => e.event === '$pageleave')?.properties.$prev_pageview_duration).toBe(603);
    expect(wire.filter(e => e.event === '$pageleave').map(e => e.properties.previous_page)).toEqual(['editor']);
    expect(wire[wire.length - 1].properties).toMatchObject({ page: 'analysis', $pathname: '/data-analysis' });
    usage.recordAction('processed_data_download_requested');
    expect(wire[wire.length - 1]).toMatchObject({
      event: 'processed_data_download_requested',
      properties: { page: 'analysis', environment: 'beta' },
    });
    expect(JSON.stringify(wire)).not.toContain('CONTENT');
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    expect(beforeSend({ event: '$autocapture', properties: { text: 'CONTENT' } })).toBeNull();
    const total = wire.length;
    const denied = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    usage.saveConsent('decline');
    expect(usage.getConsent()).toBe('decline');
    denied.mockRestore();
    usage.recordAction('processed_data_download_requested');
    usage.recordAction('analysis_completed');
    expect(wire).toHaveLength(total);
    expect(beforeSend({ event: 'analysis_completed', properties: {} })).toBeNull();
  } finally {
    usage.saveConsent('decline');
    clock.mockRestore();
    focus.mockRestore();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  }
});
