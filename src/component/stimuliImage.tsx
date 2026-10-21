import { Button, Divider, Form, Grid, Image, Input, InputNumber, Select, Space, Switch, Tooltip, Typography } from '@arco-design/web-react';
import useWatch from '@arco-design/web-react/es/Form/hooks/useWatch';
import { IconArrowDown, IconArrowUp, IconDelete, IconPlus, IconQuestionCircle } from '@arco-design/web-react/icon';
import React, { useContext } from 'react';
import { AmpStimuli, AmpStimuliItem } from '../data/ampTypes';
import { uid } from '../data/uid';
import { PrimeValidationContext } from './PrimeValidationContext';
import { Prime } from './prime';
import sumBy from 'lodash/sumBy';


const { Item, List } = Form;
const { Row, Col } = Grid;
const { Text } = Typography;

const WIDTH_INDEX_COL = 40;
const WIDTH_TYPE_SELECTOR = 110;
const WIDTH_IMAGE_PREVIEW = 32;
const GUTTER = 10;

const InputShuffle: React.FC<{ value?: any, onChange?: (v: any) => any }> = ({ value, onChange }) => {
  const onShuffleSwitchChange = (v: boolean) => { onChange?.(v); }
  const onMaxRepeatSwitchChange = (v: boolean) => { v ? onChange?.(1) : onChange?.(true); }
  const onMaxRepeatNumberChange = (v: number) => { onChange?.(v); }
  const isShuffleEnabled = value === true || typeof value === 'number';
  const isMaxRepeatEnabled = typeof value === 'number';
  const maxRepeatValue = typeof value === 'number' ? value : undefined;
  const tooltip = (
    <Tooltip style={{ minWidth: '50em' }} content={
    <div>
      You can access the randomization result through these embeeded data:
      <li>{`shuffled_{roundIndex}_{poolIndex}_{shuffledIndex}_item_index`}</li>
      <li>{`shuffled_{roundIndex}_{poolIndex}_{shuffledIndex}_content`}</li>
      <li>{`shuffled_{roundIndex}_{poolIndex}_{shuffledIndex}_type`}</li>
      For example, "shuffled_1_2_3_content" gives you the <i>content</i> of the stimuli item which is at the <i>3rd position</i> after shuffling <i>Pool 2</i> in trial <i>Round 1</i>.
      <li>If you did not check "Add more rounds" below, always use "1" for "roundIndex".</li>
      <li>If shuffle is disbled, then the default item order is looping through all the items.</li>
    </div>
  } position='top'>
      <IconQuestionCircle />
    </Tooltip>
  );
  return (
    <Space style={{ display: 'flex' }}>
      <Text type='secondary'>Shuffle</Text>
      <Switch checked={isShuffleEnabled} onChange={onShuffleSwitchChange} />
      <Text type='secondary'>Restrict max repeat</Text>
      <Switch disabled={!isShuffleEnabled} checked={isMaxRepeatEnabled} onChange={onMaxRepeatSwitchChange} />
      <InputNumber min={1} disabled={!isMaxRepeatEnabled} value={maxRepeatValue} onChange={onMaxRepeatNumberChange} />
      {tooltip}
    </Space>
  )
}

const ImagePreview: React.FC<{ value?: AmpStimuliItem }> = ({ value }) => (
  value?.type === 'image' ? <Image src={value?.content} width={`${WIDTH_IMAGE_PREVIEW}px`} height={`${WIDTH_IMAGE_PREVIEW}px`} /> : null
);

const ImageItem: React.FC<{
  field: any,
  index: number,
  length: number,
  operation: { add: (defaultValue?: any, index?: number) => void; remove: (index: number) => void; move: (fromIndex: number, toIndex: number) => void; }
}> = ({ field, index, length, operation }) => {
  const { remove, move } = operation;
  const onClickRemove = () => { remove(index); };
  const onClickUp = () => { move(index, index - 1); };
  const onClickDown = () => { move(index, index + 1); };
  return (
    <div>
      <Row gutter={GUTTER} align='start' style={{ margin: 10 }}>
        <Col flex={`${WIDTH_INDEX_COL}px`}>
          <Text>{index + 1}</Text>
        </Col>
        <Col flex={`${WIDTH_TYPE_SELECTOR + GUTTER}px`}>
          <Item field={field + '.type'} noStyle>
            <Select options={['image', 'text']} style={{ width: WIDTH_TYPE_SELECTOR, minWidth: WIDTH_TYPE_SELECTOR, maxWidth: WIDTH_TYPE_SELECTOR, flexShrink: 0 }} />
          </Item>
        </Col>
        <Col flex={1}>
          <Item field={field + '.content'} noStyle shouldUpdate>
            {
              (value, form) => form.getFieldValue(field + '.type') === 'image' ? <Input /> : <Input.TextArea autoSize />
            }
          </Item>
        </Col>
        <Col flex={`${WIDTH_IMAGE_PREVIEW + GUTTER}px`}>
          <Item shouldUpdate field={field} noStyle>
            <ImagePreview />
          </Item>
        </Col>
        <Col flex='100px'>
          <Item field={field + '.count'} noStyle>
            <InputNumber min={0} />
          </Item>
        </Col>
        <Col flex='none'>
          <Space>
            <Button shape='circle' icon={<IconArrowUp />} style={{ visibility: index !== 0 ? 'visible' : 'hidden' }} onClick={onClickUp} />
            <Button shape='circle' icon={<IconArrowDown />} style={{ visibility: index !== length - 1 ? 'visible' : 'hidden' }} onClick={onClickDown} />
            <Button shape='circle' icon={<IconDelete />} status='danger' onClick={onClickRemove} />
          </Space>
        </Col>
      </Row>
    </div>
  )
};


const ItemsCountWithPrime: React.FC<{ field: string, index: number }> = ({ field, index }) => {
  const { form } = Form.useFormContext();
  const stimuli = Form.useWatch(field, form) as AmpStimuli;
  const totalRounds = Form.useWatch('totalRounds', form) as number;
  const primeValidation = useContext(PrimeValidationContext);

  if (stimuli.isEnablePriming && primeValidation) {
    const possibleTotalItems = primeValidation?.possibleTotalItems;
    const poolPossibleTotalItems = possibleTotalItems[index];
    return (
      <div style={{ textAlign: 'left' }}>
        <Text type='secondary'>
          {'Possible total items count: '}
          {
            poolPossibleTotalItems && (
              totalRounds === 1 ? (
                poolPossibleTotalItems[0].join(', ')
              ) : (
                poolPossibleTotalItems.map((counts, roundIndex) => (
                  <li>{`Round ${roundIndex + 1}: ${counts.join(', ')}`}</li>
                ))
              )
            )
          }
        </Text>
      </div>
    );

  } else if (!stimuli.isEnablePriming) {
    return (
      <div style={{ textAlign: 'left' }}>
        <Text type='secondary'>
          {'Total items count: '}
          {sumBy(stimuli.items, x => x.count)}
        </Text>
      </div>
    );

  } else {
    return null;
  }
};


export const StimuliImage: React.FC<{ field: string, index: number }> = ({ field, index }) => {
  const { form } = Form.useFormContext();
  const totalItems = useWatch(field + '.items', form) as AmpStimuliItem[];

  return (
    <>
      <Row gutter={GUTTER} align='center' style={{ margin: 10, textAlign: 'left' }}>
        <Col flex={`${WIDTH_INDEX_COL}px`} />
        <Col flex={`${WIDTH_TYPE_SELECTOR + GUTTER}px`}>
          Type
        </Col>
        <Col flex={1}>
          Image URL or Text Content
        </Col>
        <Col flex='100px'>
          Count
        </Col>
        <Col flex='122px' />
      </Row>
      <List field={field + '.items'}>
        {
          (fields, operation) => {
            const { add } = operation;
            const onClickAdd = () => {
              if (fields.length) {
                const lastItem = form.getFieldValue(fields[fields.length - 1].field);
                add({ ...lastItem, uid: uid() });
              } else {
                add({ type: 'text', content: '', count: 1, uid: uid() } as AmpStimuliItem)
              }
            };
            return (
              <>
                {
                  fields.map(({ key, field }, index) => {
                    return <ImageItem field={field} index={index} key={key} length={fields.length} operation={operation} />
                  })
                }
                <Row style={{ paddingLeft: WIDTH_INDEX_COL }}>
                  <Space>
                    <Button shape='round' onClick={onClickAdd} type='outline'>
                      <IconPlus />Add Item
                    </Button>
                  </Space>
                </Row>
              </>
            )
          }
        }
      </List>
      <br />
      <Item field={field + '.shuffle'}>
        <InputShuffle />
      </Item>
      <Divider />
      <Prime field={field} poolIndex={index} />
      <Divider />
      <ItemsCountWithPrime field={field} index={index} />
    </>
  );
}
