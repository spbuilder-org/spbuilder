import React, { useEffect } from 'react';
import { Alert, Button, Form, Input, InputNumber, Switch } from '@arco-design/web-react';
import type { AmpParams, PageSettings } from '../data/ampTypes';
import { defaultPage, pageFlowErrors } from '../data/pageFlow';
import { ConcurrentDisplayFrameEditor } from './concurrentDisplayFrameEditor';
import { AcceptedKeys } from './acceptedKeys';
import { PageConditionEditor, newGroup } from './pageConditionEditor';
import './pageTimeline.css';

export function PageTimeline() {
  const { form } = Form.useFormContext();
  const timeline = Form.useWatch('timeline', form) as AmpParams['timeline'];
  const stimuli = Form.useWatch('stimuli', form) as AmpParams['stimuli'];
  const totalTrials = Form.useWatch('totalTrials', form) as number;
  const totalRounds = Form.useWatch('totalRounds', form) as number;
  const keys = Form.useWatch('acceptedKeys', form) as string[];
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
  return <div className='page-timeline'>
    <p>Each position draws once from an equally likely nonempty pool. Counts are used without replacement across the round. Skipped pages use no stimuli.</p>
    {pages.map((page, i) => <section className='page-card' key={page.id} aria-label={`Page ${i + 1}`}>
      <div className='page-actions'>
        <strong>Page {i + 1}</strong>
        <Input aria-label={`Page ${i + 1} name`} placeholder='Optional name' value={page.name} style={{ maxWidth: 230 }}
          onChange={name => update(i, { ...page, name })} />
        <Button size='small' status='danger' disabled={pages.length === 1} onClick={() => remove(i)}>Delete page</Button>
      </div>
      <ConcurrentDisplayFrameEditor field={`timeline.concurrentDisplays[${i}]`} />
      <div className='page-actions'>
        <label>End page by{' '}<select aria-label={`Page ${i + 1} end method`} value={page.response.mode}
          onChange={e => update(i, { ...page, response: { ...page.response, mode: e.target.value as 'keyboard' | 'timeout' } })}>
          <option value='timeout'>Fixed duration</option><option value='keyboard'>Keyboard response</option>
        </select></label>
        {page.response.mode === 'timeout'
          ? <label>Duration (ms)<InputNumber aria-label={`Page ${i + 1} duration`} min={0} value={page.response.duration}
            onChange={duration => update(i, { ...page, response: { ...page.response, duration } })} /></label>
          : <>
            <label>Allowed keys<AcceptedKeys value={page.response.keys}
              onChange={keys => update(i, { ...page, response: { ...page.response, keys } })} /></label>
            <label>Delay before keys (ms)<InputNumber min={0} value={page.response.delayBefore}
              onChange={delayBefore => update(i, { ...page, response: { ...page.response, delayBefore } })} /></label>
            <label>Delay after response (ms)<InputNumber min={0} value={page.response.delayAfter}
              onChange={delayAfter => update(i, { ...page, response: { ...page.response, delayAfter } })} /></label>
            <label><Switch checked={page.response.timeout !== null}
              onChange={enabled => update(i, { ...page, response: { ...page.response, timeout: enabled ? Math.max(2000, page.response.delayBefore) : null } })} /> Timeout</label>
            {page.response.timeout !== null && <label>Timeout from page start (ms)<InputNumber min={page.response.delayBefore} value={page.response.timeout}
              onChange={timeout => update(i, { ...page, response: { ...page.response, timeout } })} /></label>}
          </>}
        <label>Blank interval after page (ms)<InputNumber min={0} value={page.interval}
          onChange={interval => update(i, { ...page, interval })} /></label>
      </div>
      <div className='page-actions'>
        <Switch aria-label={`Page ${i + 1} condition`} disabled={i === 0} checked={!!page.condition}
          onChange={enabled => update(i, { ...page, condition: enabled ? newGroup(pages.slice(0, i)) : undefined })} />
        <span>Show page conditionally{i === 0 ? ' (requires an earlier page)' : ''}</span>
      </div>
      {page.condition && <PageConditionEditor value={page.condition} pages={pages.slice(0, i)} frames={frames.slice(0, i)} poolCount={stimuli.length}
        onChange={condition => update(i, { ...page, condition })} />}
    </section>)}
    <Button onClick={() => form.setFieldValue('timeline', { ...timeline,
      concurrentDisplays: [...frames, [['empty']]],
      pageSettings: [...pages, { ...defaultPage(timeline, pages.length, keys), response: { mode: 'timeout', duration: 500, keys: [...keys], delayBefore: 0, delayAfter: 0, timeout: null } }],
    })}>Add page</Button>
    {errors.length > 0 && <Alert type='error' title='Complete the page settings before generating QSF' content={<ul>{errors.map(e => <li key={e}>{e}</li>)}</ul>} />}
  </div>;
}
