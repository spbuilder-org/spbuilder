import { Button, Form, Message, Space } from '@arco-design/web-react';
import { IconDownload, IconPaste, IconUpload } from '@arco-design/web-react/icon';
import React, { useRef } from 'react';
import { recordAction, type SettingsSource } from '../analytics/usage';
import type { AmpParams } from '../data/ampTypes';
import { transformOldValues, transformValuesOnSave } from '../data/backwardCompatibility';
import { getExampleAmpParams } from '../data/defaultAmpParams';
import { generateBlob } from '../data/generate';
import { useBlobUrl } from '../hooks/useBlobUrl';

const { Item } = Form;
type LoadedSettings = Exclude<SettingsSource, 'blank'>;

// Keep the blob URL tied to the button instance that Arco's Form.Item mounts.
const SaveSettingsButton = ({ values }: { values: AmpParams }) => {
  const blobUrl = useBlobUrl();
  return (
    <Button type='outline' icon={<IconDownload />}
      href={blobUrl(generateBlob(JSON.stringify(transformValuesOnSave({ values }))))}
      download='spt-generator-settings.json'
      onClick={() => recordAction('settings_download_requested')}
    >
      Save
    </Button>
  )
}

export const LoadSave = ({ onLoad }: { onLoad: (source: LoadedSettings) => void }) => {
  const { form } = Form.useFormContext();
  const loadSettingsInputRef = useRef<HTMLInputElement>(null);

  function applySettings(values: AmpParams, source: LoadedSettings) {
    form.resetFields();
    form.setFieldsValue(values);
    onLoad(source);
    recordAction(source === 'example' ? 'example_loaded' : 'settings_imported');
  }

  function loadExample() {
    if (window.confirm('⚠️⚠️⚠️ This will overwrite all settings. Continue?')) {
      applySettings(getExampleAmpParams(), 'example');
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // file selector aborted
    e.currentTarget.value = ''; // Allow loading the same settings file again after editing.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string' || !reader.result) {
          throw new Error('Cannot read file content');
        }
        const { values } = JSON.parse(reader.result);
        transformOldValues(values);
        applySettings(values, 'imported');
        Message.success('Loaded successfully. 🎉');
      } catch (e) {
        window.alert(`Loaded failed. ${e}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex' }}>
      <input
        type='file'
        style={{ display: 'none' }}
        ref={loadSettingsInputRef}
        onChange={onFileInputChange}
      />
      <Space>
        <Button type='outline' icon={<IconUpload />} onClick={() => loadSettingsInputRef.current?.click()}>
          Load
        </Button>
        <Item shouldUpdate noStyle>
          {values => <SaveSettingsButton values={values} />}
        </Item>
        <Button type='outline' icon={<IconPaste />} onClick={loadExample}>
          Use Example Settings
        </Button>
      </Space>
    </div>
  )
};
