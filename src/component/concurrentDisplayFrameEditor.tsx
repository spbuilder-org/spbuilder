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

function PoolMultiSelect({ field, options, label }: { field: string; options: { label: string; value: string | number }[]; label: string }) {
  const { form } = Form.useFormContext();
  const value = Form.useWatch(field, form) as PoolChoice | undefined;
  return <>
    <Select aria-label={label} mode='multiple' placeholder={value === 'empty' ? 'Blank' : 'Choose pools'}
      options={options} value={choicePools(value ?? 'empty')} style={{ width: 138 }}
      onChange={next => form.setFieldValue(field, next)} />
    <Button size='mini' type='text' onClick={() => form.setFieldValue(field, 'empty')}>Blank</Button>
  </>;
}

const { Row, Col } = Grid;

const ContentPoolSelector: React.FC<{ field: string, rowIndex: number, colIndex: number }> = ({ field, rowIndex, colIndex }) => {
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
    <div style={{ display: 'inline-block', width: 140, height: ROW_HEIGHT - margin * 2, margin: margin, border: '1px solid grey', backgroundColor: 'white' }}>
      <Tag color='orange' bordered>{getDisplayKey(rowIndex, colIndex)}</Tag>

      <PoolMultiSelect field={field} options={options.filter(o => o.value !== 'empty')} label={`Pools for ${getDisplayKey(rowIndex, colIndex)}`} />

    </div>
  )
}



export const ConcurrentDisplayFrameEditor: React.FC<{ field: string }> = ({ field }) => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);

  const { form } = useFormContext();
  const layout = useWatch(field, form) as ConcurrentDisplayFrame;
  const textPreview = layout?.map(row => {
    const colTexts = row.map(c => c === 'empty' ? 'blank' : choicePools(c).map(p => p < 0 ? 'Removed pool' : `Pool${p + 1}`).join(' / ') || 'Choose pools');
    return `[${colTexts.join(', ')}]`;
  }).join(' / ');

  return (
    <span>
      Stimuli Pools: {textPreview}
      <Button aria-label='Edit display layout' type='text' icon={<IconEdit style={{ color: 'rgb(var(--orange-6))' }} />} onClick={() => setIsModalVisible(true)} />
      <Modal

        title='Display Layout'
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
        footer={(cancel, ok) => ok} // hide cancel button
        style={{ minWidth: '70vw' }}
      >
        <p>You can customize the number of rows, and the number of stimuli contents in each row.</p>
        <p>Each position draws one item. Multiple selected pools are equally likely while nonempty. Positions share the remaining counts of each pool across the round.</p>
        <span style={{ color: 'rgb(var(--orange-6))' }}>Trial Question Container</span>
        <Row>
          {/* Row items */}
          <Col span={18}>
            <div>
              <Form.List field={field}>{
                (rowFields, { add, remove }) => (
                  <>
                    <div style={{ border: '1px solid rgb(var(--orange-6))', marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {
                        rowFields.map((rowField, rowIndex) => (
                          <div key={rowField.key} style={{ display: 'flex', justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <Form.List field={rowField.field}>{
                              colFields => (
                                colFields.map((colField, colIndex) => (
                                  <ContentPoolSelector field={colField.field} key={colField.key} rowIndex={rowIndex} colIndex={colIndex} />
                                ))
                              )
                            }</Form.List>
                          </div>
                        ))
                      }
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
      </Modal>
    </span>
  );
};
