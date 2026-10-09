
import { Button, Form, Message, Space } from '@arco-design/web-react';
import { IconDownload, IconPaste, IconUpload } from '@arco-design/web-react/icon';
import React, { useRef } from 'react';
import { getExampleAmpParams } from '../data/defaultAmpParams';
import { generateBlob } from '../data/generate';
import { useBlobUrl } from '../hooks/useBlobUrl';
import { transformOldValues, transformValuesOnSave } from '../data/backwardCompatibility';
const { Item } = Form;

// Arco form renders Form Item twice but displays the result of first render
// As a result, the invoked blobUrl is used.
// So, we cannot put useBlobUrl in the parent component <DownloadUpload/>.
// We must put it inside Item component <DownloadSettingsButton/> to make sure it goes with the component lifecycle.
const SaveSettingsButton: React.FC<{ values?: any }> = (values) => {
  const blobUrl = useBlobUrl();
  return (
    <Button type='outline' icon={<IconDownload />}
      href={blobUrl(generateBlob(JSON.stringify(transformValuesOnSave(values))))}
      download='spt-generator-settings.json'
    >
      Save
    </Button>
  )
}

export const LoadSave = () => {

  const { form } = Form.useFormContext();

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // file selector aborted
    e.currentTarget.value = ''; // Allow loading the same settings file again after editing.
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string | undefined;
        if (content) {
          const values = JSON.parse(content).values;
          transformOldValues(values);
          form.resetFields();
          form.setFieldsValue(values);
          Message.success('Loaded successfully. 🎉');
        } else {
          throw 'Cannot read file content';
        }
      } catch (e) {
        window.alert(`Loaded failed. ${e}`);
      }
    };
    reader.readAsText(file);
  };

  const loadSettingsInputRef = useRef<HTMLInputElement>(null);

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
        <Button type='outline' icon={<IconPaste />} onClick={
          () => { if (window.confirm('⚠️⚠️⚠️ This will overwrite all settings. Continue?')) { form.resetFields(); form.setFieldsValue(getExampleAmpParams()); } }
        }>
          Use Example Settings
        </Button>
      </Space>
    </div>
  )
};
