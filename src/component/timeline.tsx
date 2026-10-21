import { Card, Divider, Form, FormInstance, InputNumber, Select, Space, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { IconArrowFall, IconQuestionCircle } from '@arco-design/web-react/icon';
import React, { Fragment, useEffect } from 'react';
import type { AmpParams, AmpStimuli, AmpTimeline } from '../data/ampTypes';
import { AddRemoveButtons } from './addRemoveButtons';
import { ConcurrentDisplayFrameEditor } from './concurrentDisplayFrameEditor';
import { addToList, removeFromList } from '../util/formUtil';
import { PageTimeline } from './pageTimeline';
import { changeTimelineMode, timelineMode, type TimelineMode } from '../data/timelineMode';
import { forEach2d } from '../util/util';

const { Item } = Form;
const { Text } = Typography;

const DEFAULT_DURATION_AND_INTERVAL = [100, 0];
const DEFAULT_CONCURRENT_DISPLAY = [['empty']];

export const ConcurrentDisplaysSelector: React.FC<{ form: FormInstance, field: string }> = ({ form, field }) => {
  const stimuliWatch = Form.useWatch('stimuli', form) as AmpStimuli[];
  const options = stimuliWatch.map((v, index) => ({
    label: `Stimuli Pool ${index + 1}`,
    value: index,
  }))
  return (
    <Form.List field={field} noStyle>
      {
        (fields, { add, remove }) => (
          <>
            {
              fields.map(({ key, field }) => (
                <div style={{ width: 140, minWidth: 140, maxWidth: 140, flexShrink: 0 }}>
                  {/* Hard container to prevent arco resizeObserver issue */}
                  <Item field={field} noStyle key={key}>
                    <Select options={options} style={{ width: 140, minWidth: 140, maxWidth: 140, flexShrink: 0 }} />
                  </Item>
                </div>
              ))
            }
            <AddRemoveButtons
              onAdd={() => add(form.getFieldValue(fields[fields.length - 1].field))}
              onRemove={() => remove(fields.length - 1)}
              disableRemove={fields.length <= 1}
            />
          </>
        )
      }
    </Form.List>
  );
}


export const Timeline: React.FC = () => {

  const { form } = Form.useFormContext();
  const stimuliWatch = Form.useWatch('stimuli', form) as AmpStimuli[];
  const timelineWatch = Form.useWatch('timeline', form) as AmpTimeline;
  const concurrentDisplaysWatch = Form.useWatch('timeline.concurrentDisplays', form) as AmpTimeline['concurrentDisplays'];
  const mode = timelineMode(timelineWatch);
  const isConcurrentDisplaysEnabled = mode !== 'simple';
  const timelineStimuliCount = timelineWatch.durationsAndIntervals.length + 1;
  const tagColor = isConcurrentDisplaysEnabled ? 'orange' : 'blue';

  // Adjust with stimuli pools
  useEffect(() => {
    if (!isConcurrentDisplaysEnabled) {
      // For simple display, adjust timeline with stimuli pool count
      resizeDurationsAndIntervalsArray(form, stimuliWatch.length);
    } else {
      // For concurrent display, update display to empty when stimuli pool is deleted
      concurrentDisplaysWatch!.forEach((frame, frameIndex) => {
        forEach2d(frame, (displayItem, row, col) => {
          if (!timelineWatch.pageSettings && typeof displayItem === 'number' && displayItem >= stimuliWatch.length) {
            form.setFieldValue(`timeline.concurrentDisplays[${frameIndex}][${row}][${col}]`, 'empty');
          }
        })
      });
    }
  }, [concurrentDisplaysWatch, isConcurrentDisplaysEnabled, form, stimuliWatch.length, timelineWatch.pageSettings]);

  const onModeChange = (next: TimelineMode) => {
    if (next === mode) return;
    const downgradeDetails = next === 'simple'
      ? 'Simple mode displays one item from each pool in sequence and uses global keyboard settings.'
      : 'Each position keeps only its first pool; only the last page accepts keyboard input.';
    if (mode === 'concurrent+conditional' && !window.confirm(
      `Switching mode removes page conditions and per-page response settings. ${downgradeDetails} Continue?`
    )) return;
    const updated = changeTimelineMode(form.getFields() as AmpParams, next);
    form.setFieldValue('timeline', updated.timeline);
    form.setFieldValue('acceptedKeys', updated.acceptedKeys);
  };
  const modeSelector = <Space>
    <label htmlFor='timeline-mode'>Mode</label>
    <Select id='timeline-mode' aria-label='Mode' value={mode} onChange={onModeChange} style={{ width: 230, minWidth: 230, maxWidth: 230, flexShrink: 0 }}
      options={[{ label: 'Simple', value: 'simple' }, { label: 'Concurrent', value: 'concurrent' }, { label: 'Concurrent+conditional', value: 'concurrent+conditional' }]} />
  </Space>;

  // Add/Remove durationsAndIntervals item as well as concurrentDisplays item
  const addConcurrentDisplaysFrame = () => {
    addToList(form, 'timeline.durationsAndIntervals', DEFAULT_DURATION_AND_INTERVAL);
    addToList(form, 'timeline.concurrentDisplays', DEFAULT_CONCURRENT_DISPLAY);
  }
  const removeConcurrentDisplaysFrame = () => {
    removeFromList(form, 'timeline.durationsAndIntervals');
    removeFromList(form, 'timeline.concurrentDisplays');
  }

  if (mode === 'concurrent+conditional') return (
    <Card style={{ textAlign: 'start' }}>
      {modeSelector}
      <PageTimeline />
    </Card>
  );

  return (
    <Card style={{ textAlign: 'start' }}>
      {modeSelector}
      {
        timelineWatch.durationsAndIntervals.map((_: any, index: number) => (
          <Fragment key={index}>
            <div style={{ margin: 10, display: 'flex', height: 30, justifyContent: 'flex-start', alignItems: 'center', gap: 10 }}>
              {/* <div style={{ width: 20, display: 'flex', alignItems: 'center'}}><IconArrowFall/></div> */}
              <IconArrowFall style={{ margin: 'auto 0', width: 16, flexShrink: 0 }} />
              <Tag bordered color={tagColor} size='medium' style={{ width: 100, height: '100%', textAlign: 'center', flexShrink: 0 }}>
                {isConcurrentDisplaysEnabled ? 'Page' : 'Stimuli'} {index + 1}
              </Tag>
              <Item field={`timeline.durationsAndIntervals[${index}][0]`} noStyle rules={[{ required: true }]}>
                <InputNumber suffix='ms' min={0} style={{ width: 160, minWidth: 80, flexShrink: 0 }} />
              </Item>
              {
                isConcurrentDisplaysEnabled && (
                  <>
                    <div style={{ width: 210, flexShrink: 0 }}><Divider /></div>
                    <ConcurrentDisplayFrameEditor field={`timeline.concurrentDisplays[${index}]`} />
                  </>
                )
              }
            </div>
            <div style={{ margin: 10, display: 'flex', height: 30, justifyContent: 'flex-start', alignItems: 'center', gap: 10 }}>
              <IconArrowFall style={{ margin: 'auto 0', width: 16 }} />
              <div style={{ width: 100, textAlign: 'center' }}>
                <Text type='secondary'  >interval</Text>
              </div>
              <Item field={`timeline.durationsAndIntervals[${index}][1]`} noStyle rules={[{ required: true }]}>
                <InputNumber suffix='ms' min={0} style={{ width: 160, minWidth: 80 }} />
              </Item>
            </div>
          </Fragment>
        ))
      }
      <div style={{ margin: 10, display: 'flex', height: 30 * 3 + 10 * 2, justifyContent: 'flex-start', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 30, alignSelf: 'start' }}><IconArrowFall /></div>
        <Tag bordered color={tagColor} size='medium' style={{ width: 100, height: '100%', textAlign: 'center', flexShrink: 0 }}>
          {isConcurrentDisplaysEnabled ? 'Page' : 'Stimuli'} {timelineStimuliCount}
        </Tag>
        <div style={{ display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', flexShrink: 0 }}>
          <Space style={{ height: 30 }}>
            <Space style={{ width: 180 }}>
              <Text type='secondary'>Delay before keyboard</Text>
              <Tooltip content={`This is the interval between displaying Stimuli ${timelineStimuliCount} and start accepting keyboard input. ("Retard")`} position='bottom'>
                <IconQuestionCircle />
              </Tooltip>
            </Space>
            <Item field='timeline.delayBeforeKeyboard' noStyle>
              <InputNumber suffix='ms' min={0} style={{ width: 160, minWidth: 80 }} />
            </Item>
          </Space>
          <Tag bordered color='green' size='medium' style={{ height: 30, textAlign: 'center' }}>
            ... await keyboard input ...
          </Tag>
          <Space style={{ height: 30 }}>
            <Space style={{ width: 180 }}>
              <Text type='secondary'>Delay after keyboard</Text>
              <Tooltip content='This is the delay after receiving keyboard input and continuing to the next trial. ("Retention")' position='bottom'>
                <IconQuestionCircle />
              </Tooltip>
            </Space>
            <Item field='timeline.delayAfterKeyboard' noStyle>
              <InputNumber suffix='ms' min={0} style={{ width: 160, minWidth: 80 }} />
            </Item>
          </Space>
        </div>
        {
          isConcurrentDisplaysEnabled && (
            <div style={{ marginBottom: 'auto', display: 'flex', height: 30, justifyContent: 'flex-start', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 22 }}><Divider /></div>
              <ConcurrentDisplayFrameEditor field={`timeline.concurrentDisplays[${concurrentDisplaysWatch!.length - 1}]`} />
            </div>
          )
        }
      </div>
      {
        isConcurrentDisplaysEnabled && (
          <AddRemoveButtons
            onAdd={addConcurrentDisplaysFrame}
            onRemove={removeConcurrentDisplaysFrame}
            disableRemove={concurrentDisplaysWatch!.length === 1}
            style={{ paddingLeft: 10 + 14 + 10 + 6 }}
            spaceSize='large'
          />
        )
      }
    </Card>
  );
}

/**
 * Adjust the size of timeline.durationsAndIntervals due to 1) add/remove stimuli pool 2) disable concurrentDisplays
 * TODO: when delete stimuli pool, better if delete the corresponding durationsAndIntervals (instead of the last one)
 */
function resizeDurationsAndIntervalsArray(form: FormInstance, stimuliLength: number) {
  const durationsAndIntervals = form.getFieldValue('timeline.durationsAndIntervals') as AmpTimeline['durationsAndIntervals'];
  const sliced = [...durationsAndIntervals, ...Array(stimuliLength).fill(DEFAULT_DURATION_AND_INTERVAL)].slice(0, stimuliLength - 1);
  form.setFieldValue('timeline.durationsAndIntervals', sliced);
}
