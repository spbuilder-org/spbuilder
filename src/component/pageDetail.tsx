import React from 'react';
import { Divider, Input, Modal, Switch, Tooltip } from '@arco-design/web-react';
import type { ConcurrentDisplayFrame, PageCondition, PageSettings } from '../data/ampTypes';
import { DisplayLayoutEditor } from './concurrentDisplayFrameEditor';
import { PageConditionEditor, newGroup } from './pageConditionEditor';
import { AcceptedKeys } from './acceptedKeys';

interface Props {
  page: PageSettings;
  index: number;
  pages: PageSettings[];
  frames: ConcurrentDisplayFrame[];
  poolCount: number;
  onChange: (page: PageSettings) => void;
  onClose: () => void;
}

export function PageDetail({ page, index, pages, frames, poolCount, onChange, onClose }: Props) {
  const earlierPages = pages.slice(0, index);
  return <Modal title='Page Condition and Layout' visible onOk={onClose} onCancel={onClose}
    className='page-detail-modal' footer={(_, ok) => ok} style={{ width: 1040, maxWidth: 'calc(100vw - 32px)' }}>
    <div className='page-detail'>
      <div className='page-actions'>
        <strong>Page {index + 1}</strong>
        <Input aria-label={`Page ${index + 1} name`} placeholder='Optional name' value={page.name}
          style={{ maxWidth: 240 }} onChange={name => onChange({ ...page, name })} />
      </div>
      <section aria-label='Page condition'>
        <h3>Page condition</h3>
        <div className='page-actions'>
          <Tooltip content='Requires an earlier page' disabled={index !== 0}>
            <span style={{ display: 'inline-flex' }}>
              <Switch aria-label={`Page ${index + 1} condition`} disabled={index === 0} checked={!!page.condition}
                style={index === 0 ? { pointerEvents: 'none' } : undefined}
                onChange={enabled => onChange({ ...page, condition: enabled ? newGroup(earlierPages) : undefined })} />
            </span>
          </Tooltip>
          <span>Show page conditionally</span>
        </div>
        {page.condition && <PageConditionEditor value={page.condition} pages={earlierPages} frames={frames.slice(0, index)}
          poolCount={poolCount} onChange={condition => onChange({ ...page, condition })} />}
      </section>
      {page.response.mode === 'keyboard' && <>
        <Divider />
        <section aria-label='Keyboard response keys'>
          <h3>Allowed input keys</h3>
          <div className='page-detail-keys'>
            <AcceptedKeys value={page.response.keys}
              onChange={keys => onChange({ ...page, response: { ...page.response, keys } })} />
          </div>
        </section>
      </>}
      <Divider />
      <section aria-label='Page layout'>
        <h3>Layout</h3>
        <DisplayLayoutEditor field={`timeline.concurrentDisplays[${index}]`} />
      </section>
    </div>
  </Modal>;
}

/** Only a single leaf is expanded on the timeline; compound logic stays in the modal. */
export function conditionPreview(condition: PageCondition, pages: PageSettings[]): string {
  if (condition.type === 'group') {
    return condition.children.length === 1
      ? conditionPreview(condition.children[0], pages)
      : 'Composite condition enabled';
  }
  const index = pages.findIndex(page => page.id === condition.pageId);
  const page = index < 0 ? 'Missing page' : `Page ${index + 1}`;
  const subject = condition.type === 'pool' ? `${page} ${condition.position} pool` : `${page} response`;
  const values = condition.type === 'pool'
    ? condition.values.map(pool => pool < 0 ? 'Removed pool' : `Pool ${pool + 1}`)
    : condition.values.map(value => value === 'TIMEOUT' ? 'Timeout' : JSON.stringify(value));
  const comparison = condition.operator === 'eq'
    ? values.length > 1 ? 'is one of' : 'is'
    : values.length > 1 ? 'is not any of' : 'is not';
  return `Condition: ${subject} ${comparison} ${values.length ? values.join(', ') : '(choose a value)'}`;
}
