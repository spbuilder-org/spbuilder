import { Button, Form, Grid, Modal, Select, Tag } from '@arco-design/web-react';
import useWatch from '@arco-design/web-react/es/Form/hooks/useWatch';
import { IconEdit } from '@arco-design/web-react/icon';
import React from 'react';
import type { AmpStimuli, ConcurrentDisplayFrame, PoolChoice } from '../data/ampTypes';
import { AddRemoveButtons } from './addRemoveButtons';
import useFormContext from '@arco-design/web-react/es/Form/hooks/useContext';
import { choicePools } from '../data/pageFlow';
import { getDisplayKey } from '../util/util';

const ROW_HEIGHT = 135;
const ITEM_WIDTH = 210;
const SELECT_WIDTH = ITEM_WIDTH - 2;

function PoolMultiSelect({ field, options, label }: { field: string; options: { label: string; value: string | number }[]; label: string }) {
  const { form } = Form.useFormContext();
  const value = Form.useWatch(field, form) as PoolChoice | undefined;
  return <>
    <Select aria-label={label} mode='multiple' placeholder='Blank'
      options={options} value={choicePools(value ?? 'empty')} style={{ width: SELECT_WIDTH, minWidth: SELECT_WIDTH, maxWidth: SELECT_WIDTH, flexShrink: 0 }}
      onChange={next => form.setFieldValue(field, next.length ? next : 'empty')} />
  </>;
}

const { Row, Col } = Grid;

const ContentPoolSelector: React.FC<{ field: string, rowIndex: number, colIndex: number, multiple: boolean }> = ({ field, rowIndex, colIndex, multiple }) => {
  const { form } = Form.useFormContext();
  const stimuliWatch = Form.useWatch('stimuli', form) as AmpStimuli[];

  const options = [
    ...stimuliWatch.map((v, index) => ({
      label: `Stimuli Pool ${index + 1}`,
      value: index,
    })),
    { label: '(empty)', value: 'empty' }
  ];
  const margin = 10;
  return (
    <div style={{ display: 'inline-block', width: ITEM_WIDTH, minWidth: ITEM_WIDTH, flexShrink: 0, height: ROW_HEIGHT - margin * 2, margin: margin, border: '1px solid grey', backgroundColor: 'white' }}>
      <Tag color='orange' bordered>{getDisplayKey(rowIndex, colIndex)}</Tag>

      <div style={{ width: SELECT_WIDTH, minWidth: SELECT_WIDTH, maxWidth: SELECT_WIDTH, flexShrink: 0 }}>
      {multiple
        ? <PoolMultiSelect field={field} options={options.filter(o => o.value !== 'empty')} label={`Pools for ${getDisplayKey(rowIndex, colIndex)}`} />
        : <Form.Item field={field} noStyle>
          <Select aria-label={`Pool for ${getDisplayKey(rowIndex, colIndex)}`} options={options} style={{ width: SELECT_WIDTH, minWidth: SELECT_WIDTH, maxWidth: SELECT_WIDTH, flexShrink: 0 }} />
        </Form.Item>}
      </div>

    </div>
  )
}



export const ConcurrentDisplayFrameEditor: React.FC<{ field: string }> = ({ field }) => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);

  const { form } = useFormContext();
  const layout = useWatch(field, form) as ConcurrentDisplayFrame;
  const textPreview = layoutPreview(layout);

  return (
    <span>
      Stimuli Pools: {textPreview}
      <Button aria-label='Edit page layout' type='text' icon={<IconEdit style={{ color: 'rgb(var(--orange-6))' }} />} onClick={() => setIsModalVisible(true)} />
      <Modal

        title='Page Layout'
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
        footer={(cancel, ok) => ok} // hide cancel button
        style={{ minWidth: '70vw' }}
      >
        <DisplayLayoutEditor field={field} multiple={false} />
      </Modal>
    </span>
  );
};

/** Shared layout body for the page detail modal and the legacy layout entry point. */
export function DisplayLayoutEditor({ field, multiple = true }: { field: string; multiple?: boolean }) {
  return <>
        <p>You can customize the number of rows, and the number of stimuli contents in each row.</p>
        {multiple && <p>Each position draws one item. Multiple selected pools are equally likely while nonempty. Positions share the remaining counts of each pool across the round.</p>}
        <span style={{ color: 'rgb(var(--orange-6))' }}>Trial Question Container</span>
        <Row>
          {/* Row items */}
          <Col span={18}>
            <div>
              <Form.List field={field}>{
                (rowFields, { add, remove }) => (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ border: '1px solid rgb(var(--orange-6))', boxSizing: 'border-box', width: 'max-content', minWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {
                          rowFields.map((rowField, rowIndex) => (
                            <div key={rowField.key} style={{ display: 'flex', justifyContent: 'center', flexWrap: 'nowrap' }}>
                              <Form.List field={rowField.field}>{
                                colFields => (
                                  colFields.map((colField, colIndex) => (
                                    <ContentPoolSelector field={colField.field} key={colField.key} rowIndex={rowIndex} colIndex={colIndex} multiple={multiple} />
                                  ))
                                )
                              }</Form.List>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
                      <AddRemoveButtons onAdd={() => add(['empty'])} onRemove={() => remove(rowFields.length - 1)} />
                    </div>
                  </>
                )
              }</Form.List>
            </div>
          </Col>
          {/* AddRemove buttons */}
          <Col span={6} style={{ paddingLeft: 10 }}>
            <Form.List field={field}>
              {
                (rowFields, rowActions) => (
                  rowFields.map((rowField, rowIndex) => (
                    <Form.List field={rowField.field} key={rowField.key}>{
                      (colFields, colActions) => (
                        <div style={{ height: ROW_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <AddRemoveButtons
                            onAdd={() => colActions.add('empty')}
                            onRemove={() => colFields.length === 1 ? rowActions.remove(rowIndex) : colActions.remove(colFields.length - 1)}
                          />
                        </div>
                      )
                    }</Form.List>
                  ))
                )
              }
            </Form.List>
          </Col>
        </Row>
        <p>To configure the gap width between contents, please go to "Trial Block HTML".</p>
  </>;
}

export function layoutPreview(layout?: ConcurrentDisplayFrame) {
  return layout?.map(row => {
    const colTexts = row.map(c => choicePools(c).length === 0 ? 'blank' : choicePools(c).map(p => p < 0 ? 'Removed pool' : `Pool${p + 1}`).join(' / '));
    return `[${colTexts.join(', ')}]`;
  }).join(' / ');
}
