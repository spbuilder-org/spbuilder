import React, { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Form, Input, InputNumber, Popover, Radio, Select, Space, Switch, Typography } from '@arco-design/web-react';
import type { AmpParams, AmpStimuliItem, AmpTimeline, AmpTrialHtml } from '../data/ampTypes';
import { renderTrialHtml } from '../data/renderTrialHtml';
import type { ArcoFormItem } from '../util/arco';
import { StimuliThumbnail } from './stimuliThumbnail';
import useFormContext from '@arco-design/web-react/es/Form/hooks/useContext';
import useWatch from '@arco-design/web-react/es/Form/hooks/useWatch';
import { IconRefresh, IconToLeft, IconToRight } from '@arco-design/web-react/icon';
import { CompactPicker } from 'react-color';
import { TrialHtmlPreview } from './trialHtmlPreview';

const { Item } = Form;
const { Option } = Select;
const { Text } = Typography;

const TextColorPicker: React.FC<ArcoFormItem<AmpTrialHtml['textColor']>> = ({ value, onChange }) => (
  <Space size='mini'>
    <Text type='secondary'>Font color</Text>
    <Popover
      trigger='click'
      position='right'
      content={
        <Space direction='vertical'>
          <CompactPicker color={value ?? '#000'} onChange={v => onChange?.(v.hex)} />
          <Button size='mini' type='secondary' icon={<IconRefresh />} onClick={() => onChange?.(undefined)}>
            Use default color of your Qualtrics skin
          </Button>
        </Space>
      }
    >
      {
        value === undefined ?
          <Button size='mini' type='secondary'>(default)</Button> :
          <Button size='mini' style={{ backgroundColor: value, boxShadow: 'grey 0 0 2px' }}></Button>
      }
    </Popover>
  </Space>
);


const ConfigModeForm: React.FC = () => {

  // When change to darkMode, change text content color
  const { form } = useFormContext();
  const darkModeWatch = useWatch('trialHtml.darkMode', form) as AmpParams['trialHtml']['darkMode'];
  useEffect(() => {
    if (darkModeWatch === true) {
      form.setFieldValue('trialHtml.textColor', '#fff');
    } else {
      form.setFieldValue('trialHtml.textColor', '#000');
    }
  }, [darkModeWatch, form]);

  const concurrentDisplaysWatch = useWatch('timeline.concurrentDisplays', form) as AmpTimeline['concurrentDisplays'];
  const isConcurrentDisplaysEnabled = Boolean(concurrentDisplaysWatch);

  // Set default value when enabling concurrent; reset to undefined when disabling
  useEffect(() => {
    if (isConcurrentDisplaysEnabled) {
      if (form.getFieldValue('trialHtml.concurrentVerticalGap') === undefined) form.setFieldValue('trialHtml.concurrentVerticalGap', 0);
      if (form.getFieldValue('trialHtml.concurrentHorizontalGap') === undefined) form.setFieldValue('trialHtml.concurrentHorizontalGap', 0);
    } else {
      form.clearFields(['trialHtml.concurrentVerticalGap', 'trialHtml.concurrentHorizontalGap']);
    }
  }, [isConcurrentDisplaysEnabled]);


  return (
    <div>
      <Space size='large'>
        <Item field='trialHtml.width' label={
          <b>Content width <IconToLeft /><IconToRight /></b>
        } style={{ width: 200 }}>
          <InputNumber suffix='px' />
        </Item>
        <Item field='trialHtml.height' label={
          <b>Content height <IconToLeft style={{ transform: 'rotate(90deg)', transformOrigin: 'right' }} /><IconToRight style={{ transform: 'rotate(90deg)', transformOrigin: 'left' }} /></b>
        } style={{ width: 200 }}>
          <InputNumber suffix='px' />
        </Item>
      </Space>

      <Item field='trialHtml.marginTop' label={<b>Blank space above content</b>} layout='vertical' style={{ width: 200 }}>
        <InputNumber suffix='px' />
      </Item>

      <Item field='trialHtml.darkMode' label={<b>Dark mode</b>} layout='vertical' triggerPropName='checked'>
        <Switch />
      </Item>

      {
        isConcurrentDisplaysEnabled && (
          <div>
            <Item label={<b>Gap between contents (for concurrent pages only)</b>}>
              <Space size='large'>
                <Item field='trialHtml.concurrentVerticalGap' label={<b>Vertical gap</b>}>
                  <InputNumber suffix='px' style={{ width: 200 }} />
                </Item>
                <Item field='trialHtml.concurrentHorizontalGap' label={<b>Horizontal gap</b>}>
                  <InputNumber suffix='px' style={{ width: 200 }} />
                </Item>
              </Space>
            </Item>
          </div>
        )
      }

      <Item label={<b>Text stimuli style</b>} layout='vertical'>
        <Space size={50} style={{ width: '100%' }} >
          <Space size='mini'>
            <Text type='secondary'>Font size</Text>
            <Item field='trialHtml.textFontSize' noStyle layout='inline'>
              <InputNumber suffix='px' min={1} style={{ width: 100 }} />
            </Item>
          </Space>
          <Item field='trialHtml.textIsBold' noStyle triggerPropName='checked'>
            <Checkbox><Text type='secondary'>Bold</Text></Checkbox>
          </Item>
          <Item field='trialHtml.textColor' noStyle>
            <TextColorPicker />
          </Item>
          <Item field='trialHtml.textWrap' noStyle triggerPropName='checked'>
            <Checkbox><Text type='secondary'>Wrap text</Text></Checkbox>
          </Item>
        </Space>
      </Item>

      <Item field='trialHtml.instruction' label={<b>Instruction Text</b>} layout='vertical'>
        <Input.TextArea style={{ minHeight: '6em' }} />
      </Item>
    </div>
  );
};


const CustomModeForm: React.FC = () => (
  <Item field='trialHtml.customHtml' noStyle>
    <Input.TextArea
      style={{ minHeight: '15em', fontFamily: 'Inconsolata, Consolas, monospace' }}
    />
  </Item>
);


export const TrialHtml: React.FC = () => {

  const { form } = useFormContext();
  const trialHtmlWatch = useWatch('trialHtml', form) as AmpParams['trialHtml'];
  const isConfigMode = typeof trialHtmlWatch.customHtml !== 'string';
  const concurrentDisplaysWatch = useWatch('timeline.concurrentDisplays', form) as AmpTimeline['concurrentDisplays'];

  // When switch to custom mode, render from current configs.
  // When switch to config mode, clear customHtml after confirmation.
  const onModeChange = (isNewModeConfigMode: boolean) => {
    if (isNewModeConfigMode) {
      if (trialHtmlWatch.customHtml !== renderTrialHtml(trialHtmlWatch, concurrentDisplaysWatch)) {
        if (!window.confirm('Switching to Use Configurations will revert all the edits in Customized HTML. Continue?')) {
          return;
        }
      }
      form.setFieldValue('trialHtml.customHtml', undefined);
    } else {
      form.setFieldValue('trialHtml.customHtml', renderTrialHtml(trialHtmlWatch, concurrentDisplaysWatch));
    }
  }

  return (
    <div style={{ textAlign: 'start' }}>
      <div>
        <Radio.Group
          type='button'
          value={isConfigMode}
          onChange={onModeChange}
          options={[
            { value: true, label: 'Use Configurations' },
            { value: false, label: 'Customize HTML' },
          ]}
          style={{ marginBottom: '12px' }}
        />
      </div>

      {isConfigMode ? <ConfigModeForm /> : <CustomModeForm />}
      <Item shouldUpdate>
        {() => <TrialHtmlPreview />}
      </Item>
    </div>
  )
};
