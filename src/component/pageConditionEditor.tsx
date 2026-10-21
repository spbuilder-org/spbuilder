import React from 'react';
import { Button, Select } from '@arco-design/web-react';
import { IconDelete } from '@arco-design/web-react/icon';
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

const fixedWidth = (width: number): React.CSSProperties => ({ width, minWidth: width, maxWidth: width, flexShrink: 0 });

export function PageConditionEditor({ value, onChange, pages, frames, poolCount, onRemove }: Props) {
  if (value.type === 'group') return (
    <fieldset className='condition-group'>
      <legend>
        <Select aria-label='Condition group operator' value={value.operator} style={fixedWidth(200)}
          options={[{ value: 'and', label: 'AND — all conditions' }, { value: 'or', label: 'OR — any condition' }]}
          onChange={operator => onChange({ ...value, operator })} />
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
    <Select aria-label='Condition type' value={value.type} style={fixedWidth(150)}
      options={[{ value: 'response', label: 'Response of' }, { value: 'pool', label: 'Source pool of' }]}
      onChange={type => onChange(type === 'pool'
      ? { type: 'pool', pageId: value.pageId, position: 'A1', operator: 'eq', values: [] }
      : { type: 'response', pageId: value.pageId, operator: 'eq', values: [] })} />
    <Select aria-label='Source page' value={value.pageId || undefined} placeholder='Choose earlier page' style={fixedWidth(180)}
      onChange={pageId => onChange({ ...value, pageId, values: [] })}
      options={[
        ...(sourceIndex < 0 && value.pageId ? [{ value: value.pageId, label: 'Missing page', disabled: true }] : []),
        ...pages.map((p, i) => ({ value: p.id, label: `Page ${i + 1}${p.name ? `: ${p.name}` : ''}` })),
      ]} />
    {value.type === 'pool' && <Select aria-label='Source position' value={value.position} style={fixedWidth(64)}
      onChange={position => onChange({ ...value, position })}
      options={(frames[sourceIndex] ?? []).flatMap((row, r) => row.map((_, c) => {
        const key = getDisplayKey(r, c); return { value: key, label: key };
      }))} />}
    <Select aria-label='Condition comparison' value={value.operator} style={fixedWidth(140)}
      options={[{ value: 'eq', label: 'is one of' }, { value: 'neq', label: 'is not any of' }]}
      onChange={operator => onChange({ ...value, operator })} />
    <div className='condition-values-select'>
    {value.type === 'pool'
      ? <Select aria-label='Condition pools' mode='multiple' placeholder='Choose pools' style={fixedWidth(180)}
        options={Array.from({ length: poolCount }, (_, i) => ({ value: i, label: `Pool ${i + 1}` }))}
        value={value.values} onChange={values => onChange({ ...value, values })} />
      : <Select aria-label='Condition responses' mode='multiple' placeholder='Choose responses' style={fixedWidth(180)}
        options={responseOptions} value={value.values} onChange={values => onChange({ ...value, values })} />}
    </div>
    {onRemove && <Button size='small' type='text' status='danger' icon={<IconDelete />}
      aria-label='Delete condition' title='Delete condition' onClick={onRemove} />}
  </div>;
}
