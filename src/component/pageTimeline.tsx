import React, { useEffect, useState } from 'react';
import { Alert, Button, Divider, Form, InputNumber, Select, Switch } from '@arco-design/web-react';
import { IconArrowFall, IconDelete, IconEdit } from '@arco-design/web-react/icon';
import type { AmpParams, PageSettings } from '../data/ampTypes';
import { defaultPage, pageFlowErrors } from '../data/pageFlow';
import { layoutPreview } from './concurrentDisplayFrameEditor';
import { PageDetail, conditionPreview } from './pageDetail';
import './pageTimeline.css';

export function PageTimeline() {
  const { form } = Form.useFormContext();
  const timeline = Form.useWatch('timeline', form) as AmpParams['timeline'];
  const stimuli = Form.useWatch('stimuli', form) as AmpParams['stimuli'];
  const totalTrials = Form.useWatch('totalTrials', form) as number;
  const totalRounds = Form.useWatch('totalRounds', form) as number;
  const keys = Form.useWatch('acceptedKeys', form) as string[];
  const [detailId, setDetailId] = useState<string>();
  const frames = timeline.concurrentDisplays!;
  const pages = timeline.pageSettings;
  useEffect(() => {
    if (!pages) form.setFieldValue('timeline.pageSettings', frames.map((_, i) => defaultPage(timeline, i, keys)));
  }, [pages, frames, timeline, keys, form]);
  if (!pages) return null;
  function update(index: number, page: PageSettings) {
    form.setFieldValue('timeline.pageSettings', pages!.map((p, i) => i === index ? page : p));
  }
  function remove(index: number) {
    form.setFieldValue('timeline', { ...timeline,
      concurrentDisplays: frames.filter((_, i) => i !== index),
      pageSettings: pages!.filter((_, i) => i !== index),
    });
  }
  const errors = pageFlowErrors({ ...form.getFields(), totalTrials, totalRounds } as AmpParams);
  const detailIndex = pages.findIndex(page => page.id === detailId);
  return <div className='page-timeline'>
    {pages.map((page, i) => {
      const summary = page.condition ? conditionPreview(page.condition, pages) : undefined;
      return <section className='display-step' key={page.id} aria-label={`Page ${i + 1} settings`}>
        <div className='display-row'>
          <IconArrowFall className='display-arrow' />
          <button type='button' className={`display-box${page.condition ? ' display-box-conditional' : ''}`}
            aria-label={`Page ${i + 1}`} title={page.name || 'Page Condition and Layout'} onClick={() => setDetailId(page.id)}>
            Page {i + 1}
          </button>
          <div className='page-response'>
            <div className='display-duration-row'>
              <Select aria-label={`Page ${i + 1} end method`} value={page.response.mode}
                style={{ width: 210, minWidth: 210, maxWidth: 210 }}
                options={[{ value: 'timeout', label: '🕒 Fixed duration' }, { value: 'keyboard', label: '⌨️ Keyboard response' }]}
                onChange={mode => update(i, { ...page, response: { ...page.response, mode } })} />
              {page.response.mode === 'timeout' && <InputNumber aria-label={`Page ${i + 1} duration`} min={0} suffix='ms'
                value={page.response.duration} onChange={duration => update(i, { ...page, response: { ...page.response, duration } })} />}
            </div>
            {page.response.mode === 'keyboard' && <>
              <label className='display-response-row'>Delay before keyboard
                <InputNumber aria-label={`Page ${i + 1} delay before keyboard`} suffix='ms' min={0} value={page.response.delayBefore}
                  onChange={delayBefore => update(i, { ...page, response: { ...page.response, delayBefore } })} />
              </label>
              <div className='display-response-keys'>Await keyboard</div>
              <label className='display-response-row'>Delay after keyboard
                <InputNumber aria-label={`Page ${i + 1} delay after keyboard`} suffix='ms' min={0} value={page.response.delayAfter}
                  onChange={delayAfter => update(i, { ...page, response: { ...page.response, delayAfter } })} />
              </label>
              <div className='display-response-row display-timeout-row'>
                <label className='display-timeout-toggle'>
                  <Switch aria-label={`Page ${i + 1} timeout`} checked={page.response.timeout !== null}
                    onChange={enabled => update(i, { ...page, response: { ...page.response, timeout: enabled ? Math.max(2000, page.response.delayBefore) : null } })} /> Timeout
                </label>
                {page.response.timeout !== null && <InputNumber aria-label={`Page ${i + 1} timeout from page start`} suffix='ms'
                  min={page.response.delayBefore} value={page.response.timeout}
                  onChange={timeout => update(i, { ...page, response: { ...page.response, timeout } })} />}
              </div>
            </>}
          </div>
          <button type='button' className='display-detail-preview' aria-label={`Edit Page ${i + 1} condition and layout`}
            title={summary ? `${summary}\nStimuli Pools: ${layoutPreview(frames[i])}` : `Stimuli Pools: ${layoutPreview(frames[i])}`}
            onClick={() => setDetailId(page.id)}>
            <span className='display-detail-lines'>
              {summary && <span className='display-condition-preview'>{summary}</span>}
              <span>Stimuli Pools: {layoutPreview(frames[i])}</span>
            </span>
            <IconEdit />
          </button>
          <Button className='display-remove' size='mini' type='text' status='danger' icon={<IconDelete />}
            aria-label={`Delete Page ${i + 1}`} title='Delete page' disabled={pages.length === 1} onClick={() => remove(i)} />
        </div>
        <div className='display-interval-row'>
          <IconArrowFall />
          <span>Interval</span>
          <div className='display-response-row'>
            <Divider />
            <InputNumber aria-label={`Page ${i + 1} interval`} suffix='ms' min={0} value={page.interval}
              onChange={interval => update(i, { ...page, interval })} />
          </div>
        </div>
      </section>;
    })}
    <Button className='add-display' onClick={() => form.setFieldValue('timeline', { ...timeline,
      concurrentDisplays: [...frames, [['empty']]],
      pageSettings: [...pages, { ...defaultPage(timeline, pages.length, keys), response: { mode: 'timeout', duration: 500, keys: [...keys], delayBefore: 0, delayAfter: 0, timeout: null } }],
    })}>Add Page</Button>
    {detailIndex >= 0 && <PageDetail key={pages[detailIndex].id} page={pages[detailIndex]} index={detailIndex} pages={pages} frames={frames}
      poolCount={stimuli.length} onChange={page => update(detailIndex, page)} onClose={() => setDetailId(undefined)} />}
    {errors.length > 0 && <Alert type='error' title='Complete the page settings before generating QSF' content={<ul>{errors.map(e => <li key={e}>{e}</li>)}</ul>} />}
  </div>;
}
