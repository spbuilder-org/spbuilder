import React from 'react';
import { Button, Select } from '@arco-design/web-react';
import type { ConcurrentDisplayFrame, PageCondition, PageSettings } from '../data/ampTypes';
import { getDisplayKey } from '../util/util';

interface Props {
  value: PageCondition;
  onChange: (value: PageCondition) => void;
  pages: PageSettings[];
  frames: ConcurrentDisplayFrame[];
  poolCount: number;
  onRemove?: () => void;
}
export const newCondition = (pages: PageSettings[]): PageCondition => ({
  type: 'response', pageId: pages[0]?.id ?? '', operator: 'eq', values: [],
});
export const newGroup = (pages: PageSettings[]): PageCondition => ({
  type: 'group', operator: 'and', children: [newCondition(pages)],
});

export function PageConditionEditor({ value, onChange, pages, frames, poolCount, onRemove }: Props) {
  if (value.type === 'group') return (
    <fieldset className='condition-group'>
      <legend>
        <select aria-label='Condition group operator' value={value.operator}
          onChange={e => onChange({ ...value, operator: e.target.value as 'and' | 'or' })}>
          <option value='and'>AND — all conditions</option><option value='or'>OR — any condition</option>
        </select>
      </legend>
      {value.children.map((child, index) => <PageConditionEditor key={index} value={child}
        pages={pages} frames={frames} poolCount={poolCount}
        onChange={next => onChange({ ...value, children: value.children.map((old, i) => i === index ? next : old) })}
        onRemove={() => onChange({ ...value, children: value.children.filter((_, i) => i !== index) })} />)}
      <div className='page-actions'>
        <Button size='small' onClick={() => onChange({ ...value, children: [...value.children, newCondition(pages)] })}>Add condition</Button>
        <Button size='small' onClick={() => onChange({ ...value, children: [...value.children, newGroup(pages)] })}>Add group</Button>
        {onRemove && <Button size='small' status='danger' onClick={onRemove}>Delete group</Button>}
      </div>
      {!value.children.length && <p role='alert'>Add a condition or delete this empty group.</p>}
    </fieldset>
  );
  const sourceIndex = pages.findIndex(p => p.id === value.pageId);
  const source = pages[sourceIndex];
  const responseOptions = source ? [
    ...(source.response.mode === 'keyboard' ? source.response.keys.map(key => ({ label: key, value: key })) : []),
    ...(source.response.mode === 'timeout' || source.response.timeout !== null ? [{ label: 'Timeout', value: 'TIMEOUT' }] : []),
  ] : [];
  return <div className='condition-row'>
    <select aria-label='Condition type' value={value.type} onChange={e => onChange(e.target.value === 'pool'
      ? { type: 'pool', pageId: value.pageId, position: 'A1', operator: 'eq', values: [] }
      : { type: 'response', pageId: value.pageId, operator: 'eq', values: [] })}>
      <option value='response'>Response of</option><option value='pool'>Source pool of</option>
    </select>
    <select aria-label='Source page' value={value.pageId} onChange={e => onChange({ ...value, pageId: e.target.value, values: [] })}>
      <option value='' disabled>Choose earlier page</option>
      {sourceIndex < 0 && value.pageId && <option value={value.pageId}>Missing page</option>}
      {pages.map((p, i) => <option key={p.id} value={p.id}>Page {i + 1}{p.name ? `: ${p.name}` : ''}</option>)}
    </select>
    {value.type === 'pool' && <select aria-label='Source position' value={value.position}
      onChange={e => onChange({ ...value, position: e.target.value })}>
      {(frames[sourceIndex] ?? []).flatMap((row, r) => row.map((_, c) => {
        const key = getDisplayKey(r, c); return <option key={key} value={key}>{key}</option>;
      }))}
    </select>}
    <select aria-label='Condition comparison' value={value.operator}
      onChange={e => onChange({ ...value, operator: e.target.value as 'eq' | 'neq' })}>
      <option value='eq'>is one of</option><option value='neq'>is not any of</option>
    </select>
    {value.type === 'pool'
      ? <Select aria-label='Condition pools' mode='multiple' placeholder='Choose pools' style={{ minWidth: 150, flex: 1 }}
        options={Array.from({ length: poolCount }, (_, i) => ({ value: i, label: `Pool ${i + 1}` }))}
        value={value.values} onChange={values => onChange({ ...value, values })} />
      : <Select aria-label='Condition responses' mode='multiple' placeholder='Choose responses' style={{ minWidth: 150, flex: 1 }}
        options={responseOptions} value={value.values} onChange={values => onChange({ ...value, values })} />}
    {onRemove && <Button size='small' status='danger' onClick={onRemove}>Delete condition</Button>}
  </div>;
}
