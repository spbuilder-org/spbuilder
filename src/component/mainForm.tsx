import { Alert, Collapse, Form, InputNumber, type FormInstance, Tooltip, Space } from '@arco-design/web-react';
import throttle from 'lodash/throttle';
import React, { useEffect, useRef, useState } from 'react';
import type { AmpParams } from '../data/ampTypes';
import { emptyAmpParams } from '../data/emptyAmpParams';
import { generateBlob, generateQsfString } from '../data/generate';
import { PrimeValidation, getPrimeValidation, initialPrimeValidation } from '../data/primeValidation';
import { useBlobUrl } from '../hooks/useBlobUrl';
import { PrimeValidationContext } from './PrimeValidationContext';
import { AcceptedKeys } from './acceptedKeys';
import { AutoProceedTimeout } from './autoProceedTimeout';
import { BubblyButton } from './bubblyButton';
import { LoadSave } from './loadSave';
import { MultiRounds } from './multiRounds';
import { StimuliPool } from './stimuliPool';
import { Timeline } from './timeline';
import { TrialHtml } from './trialHtml';
import { WarnTotalTrials } from './warnTotalTrials';
import { IconCloudDownload, IconQuestionCircle } from '@arco-design/web-react/icon';
import { Debugger } from './debugger';
const { Item } = Form;


const DownloadButton: React.FC<{ values?: AmpParams }> = ({ values }) => {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const blobUrl = useBlobUrl();
  const throttledSetBlob = useRef<(values?: AmpParams) => void>();
  if (!throttledSetBlob.current) {
    throttledSetBlob.current = throttle((values?: AmpParams) => {
      if (values) {
        try {
          setUrl(blobUrl(generateBlob(generateQsfString(values))));
          setError(undefined);
        } catch (e) {
          setUrl(undefined); setError(String(e instanceof Error ? e.message : e));
        }
      }
    }, 500, { leading: true, trailing: true });
  }
  useEffect(() => { setUrl(undefined); throttledSetBlob.current?.(values); }, [values]);
  useEffect(() => () => (throttledSetBlob.current as any)?.cancel(), []);
  if (error) return <Alert type='error' title='Cannot generate QSF yet' content={error} />;
  return (
    <BubblyButton href={url} download='spt-generator.qsf'>
      <Space>
        <IconCloudDownload style={{ fontSize: '1.5em' }} />
        Generate Qualtrics qsf File
      </Space>
    </BubblyButton>
  );
};


export const MainForm: React.FC<{}> = ({ }) => {

  console.log('MainForm')
  const formRef = useRef<FormInstance<AmpParams>>(null);

  const [primeValidation, setPrimeValidation] = useState<PrimeValidation | null>(null);

  const onValuesChange = (changeValue: Partial<AmpParams>, values: Partial<AmpParams>) => {
    console.log('onValuesChange: ', changeValue, values);
    if (values.stimuli && values.totalRounds) {
      setPrimeValidation(getPrimeValidation(values.stimuli, values.totalRounds));
    }
  };

  return (
    <PrimeValidationContext.Provider value={primeValidation}>
      <Form
        layout='vertical'
        ref={formRef}
        initialValues={emptyAmpParams}
        onValuesChange={onValuesChange}
      >
        {window.location.hostname === 'localhost' && <Debugger />}
        <LoadSave />
        <h3 style={{ textAlign: 'left' }}>Stimuli Pool</h3>
        <StimuliPool />
        <br />

        <h3 style={{ textAlign: 'left' }}>Trial Timeline</h3>

        <Item field='timeline'>
          <Timeline />
        </Item>

        <span style={{ textAlign: 'left' }}>
          <Item label='Number of total trials' field='totalTrials' >
            <InputNumber min={0} style={{ width: 160 }} suffix='trials' />
          </Item>
          <Item shouldUpdate noStyle>
            {values => <WarnTotalTrials values={values} />}
          </Item>
          <MultiRounds />
          <Item shouldUpdate noStyle>{values => !values.timeline?.pageSettings ? <>
          <Item
            label={
              <>
                Allowed Input Keys &nbsp;
                <Tooltip content={`The keys that participants are allowed to press.\nParticipants' responses will be recorded in Qualtrics survey result data.`}>
                  <IconQuestionCircle />
                </Tooltip>
              </>
            }
            field='acceptedKeys'
            extra='Letters (a~z, case insensitive), Number digits (0~9), Arrow keys, Space key.'
          >
            <AcceptedKeys />
          </Item>
          <Item field='timeline.autoProceedTimeout'>
            <AutoProceedTimeout />
          </Item>
          </> : null}</Item>
        </span>

        <Collapse bordered={false} style={{ marginBottom: 20 }}>
          <Collapse.Item name='0' header={<h3>Trial Block HTML</h3>}>
            <TrialHtml />
          </Collapse.Item>
        </Collapse>

        <Item shouldUpdate>
          {
            values => (
              <DownloadButton values={values} />
            )
          }
        </Item>
      </Form >
    </PrimeValidationContext.Provider>
  )
};
