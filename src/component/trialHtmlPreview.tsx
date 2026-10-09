import { Form, Select, Space, Typography } from '@arco-design/web-react';
import useFormContext from '@arco-design/web-react/es/Form/hooks/useContext';
import useWatch from '@arco-design/web-react/es/Form/hooks/useWatch';
import { cloneDeep, isEqual } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import type { AmpParams, AmpTimeline, ConcurrentDisplayFrame } from '../data/ampTypes';
import { choicePools } from '../data/pageFlow';
import { renderTrialHtml } from '../data/renderTrialHtml';
import { forEach2d, getDisplayKey, map2d } from '../util/util';
import { StimuliThumbnail } from './stimuliThumbnail';

const { Option } = Select;
const { Text } = Typography;



type LayoutedDisplayUids = (number | 'empty')[][];
interface PreviewUidsSelector {
  previewUids: LayoutedDisplayUids;
  updatePreviewUids: (previewUids: LayoutedDisplayUids) => void;
}


const SinglePreviewSelector: React.FC<PreviewUidsSelector> = ({ previewUids, updatePreviewUids }) => {
  const { form } = useFormContext();
  const stimuliWatch = useWatch('stimuli', form) as AmpParams['stimuli'];
  const allItems = stimuliWatch.flatMap((stimuli, stimuliIndex) => (
    stimuli.items.map((item, itemIndex) => ({ ...item, indexDisplay: `${stimuliIndex + 1}-${itemIndex + 1}` }))
  ));

  const [uid, setUid] = useState<number | undefined>();


  const updateUid = (uid: number | undefined) => {
    setUid(uid);
    updatePreviewUids([[uid ?? 'empty']]);
  }

  // If stimuli updates and the previewStimuliItem is deleted, reset previewStimuliItem
  const isUidValid = Boolean(allItems.find(x => x.uid === uid));
  useEffect(() => {
    if (!isUidValid) {
      updateUid(undefined);
    }
  }, [isUidValid]);


  return (
    <Space size='large'>
      <h3>Preview</h3>
      <Select
        placeholder='Select a stimuli item to preview'
        style={{ width: 300, height: 32 }}
        value={uid}
        onChange={updateUid}
        allowClear
      >
        {
          allItems.map((item) => (
            <Option key={item.uid} value={item.uid}>
              <StimuliThumbnail {...item} />
            </Option>
          ))
        }
      </Select>
    </Space>
  );
};


const ConcurrentPreviewSelector: React.FC<PreviewUidsSelector> = ({ previewUids, updatePreviewUids }) => {

  const { form } = useFormContext();
  const stimuliWatch = useWatch('stimuli', form) as AmpParams['stimuli'];
  const [previewFrameIndex, setPreviewFrameIndex] = useState<number>();
  const concurrentDisplaysWatch = useWatch('timeline.concurrentDisplays', form) as ConcurrentDisplayFrame[];

  // When frameIndex becomes invalid, reset to undefined
  useEffect(() => {
    if (previewFrameIndex !== undefined && previewFrameIndex >= concurrentDisplaysWatch.length) {
      setPreviewFrameIndex(undefined);
    }
  }, [previewFrameIndex, concurrentDisplaysWatch.length]);

  // Layouted uids that fit the layout of selected frame
  const resizedUids = previewFrameIndex !== undefined && concurrentDisplaysWatch[previewFrameIndex] ? (
    map2d(concurrentDisplaysWatch[previewFrameIndex], (_, row, col) => previewUids[row]?.[col] ?? 'empty')
  ) : [[]];

  useEffect(() => {
    if (!isEqual(resizedUids, previewUids)) {
      updatePreviewUids(resizedUids);
    }
  });

  /** Update one uid in uidsRef */
  const updateOneUid = (row: number, col: number, uid: number | 'empty') => {
    const uidsClone = cloneDeep(resizedUids);
    uidsClone[row][col] = uid;
    updatePreviewUids(uidsClone);
  };

  return (
    <>
      <h3>Preview</h3>

      <Select
        placeholder='Select a Display in the trial timeline'
        style={{ width: 200, height: 32, marginBottom: 10 }}
        value={previewFrameIndex}
        onChange={setPreviewFrameIndex}
        options={concurrentDisplaysWatch.map((layout, index) => ({ label: `Display ${index + 1}`, value: index }))}
      />
      <Space size='large'>
        {
          previewFrameIndex !== undefined && concurrentDisplaysWatch[previewFrameIndex]?.map((row, rowIndex) => {
            return row.map((col, colIndex) => (

              <Form.Item layout='inline' label={getDisplayKey(rowIndex, colIndex)}>
                <Select
                  placeholder={col === 'empty' ? '(empty)' : undefined}
                  style={{ width: 160, height: 32 }}
                  disabled={col === 'empty'}
                  value={resizedUids[rowIndex][colIndex]}
                  onChange={uid => updateOneUid(rowIndex, colIndex, uid ?? 'empty')}
                >
                  {
                    choicePools(col).flatMap(poolIndex => (stimuliWatch[poolIndex]?.items ?? []).map((item, itemIndex) => (
                      <Option key={item.uid} value={item.uid}>
                        <StimuliThumbnail {...item} indexDisplay={`${poolIndex + 1}-${itemIndex + 1}`} />
                      </Option>
                    )))
                  }
                </Select>
              </Form.Item>
            ));
          })
        }
      </Space>
    </>
  )
}


export const TrialHtmlPreview: React.FC = () => {

  const { form } = useFormContext();
  const stimuliWatch = useWatch('stimuli', form) as AmpParams['stimuli'];

  const previewRef = useRef<HTMLIFrameElement>(null);
  const trialHtmlWatch = useWatch('trialHtml', form) as AmpParams['trialHtml'];
  const concurrentDisplaysWatch = useWatch('timeline.concurrentDisplays', form) as AmpTimeline['concurrentDisplays'];
  const previewInnerHtml = trialHtmlWatch.customHtml ?? renderTrialHtml(trialHtmlWatch, concurrentDisplaysWatch);


  const [uids, setUids] = useState<LayoutedDisplayUids>([[]]);

  const renderPreview = () => {
    const previewStimuliItems = map2d(uids, uid => {
      if (uid === 'empty') {
        return { type: 'empty', content: '' } as const;
      } else if (typeof uid === 'number') {
        return stimuliWatch.flatMap(stimuli => stimuli.items).find(i => i.uid === uid) ?? { type: 'empty', content: '' } as const;
      } else {
        return null;
      }
    });
    renderTrialPreview(previewRef, previewInnerHtml, previewStimuliItems, trialHtmlWatch.darkMode)
  };
  useEffect(renderPreview);


  return (
    <div style={{ display: 'flex', flexDirection: 'column' }} >
      {
        concurrentDisplaysWatch ?
          <ConcurrentPreviewSelector previewUids={uids} updatePreviewUids={setUids} />
:
          <SinglePreviewSelector previewUids={uids} updatePreviewUids={setUids} />
      }
      <iframe style={{ flexGrow: 1 }} ref={previewRef} height={700} title='HTML Preview'></iframe>
      <Text type='secondary'>(The grey border of content area will not be visible in the generated survey.)</Text>
    </div >
  )
}


// const QUALTRICS_DEFAULT_SKIN = {
//   fontSize: '24',
//   fontWeight: '400',
//   fontFamily: 'Poppins,Arial,sans-serif',
//   color: '#757575',
//   lineHeight: '1.5em',
// } as const; // as Partial<CSSStyleDeclaration>;



// @font-face {
//   font-family: Poppins;
//   src: url(/fonts/poppinslight.ttf);
//   font-style: normal;
//   font-weight: 400
// }
// @font-face {
//   font-family: Poppins;
//   src: url(/fonts/poppinslight.ttf);
//   font-style: italic;
//   font-weight: 400
// }
const QUALTRICS_STYLE = `
body {
  font-size: 24px;
  font-weight: 400px;
  font-family: Poppins,Arial,sans-serif;
  color: #757575;
  line-height: 1.5em;
}
/* For visibility in preview */
.spt-trial-content {
  border: 1px solid grey;
}
`;

type StimuliItemToDisplay = { type: 'image' | 'text' | 'empty', content: string } | null;

function renderTrialPreview(
  previewRef: React.MutableRefObject<HTMLIFrameElement | null>,
  previewInnerHtml: string,
  previewStimuliItems: StimuliItemToDisplay[][],
  darkMode: boolean,
) {
  const iframeDocument = previewRef.current?.contentDocument;
  if (iframeDocument) {
    // Set style once 
    if (!iframeDocument.getElementById('preview-style')) {
      const styleEl = iframeDocument.createElement('style');
      styleEl.id = 'preview-style';
      styleEl.appendChild(iframeDocument.createTextNode(QUALTRICS_STYLE));
      iframeDocument.head.appendChild(styleEl);
    }
    // Set body html
    iframeDocument.body.innerHTML = previewInnerHtml;
    // Simulate mode page background
    iframeDocument.body.style.backgroundColor = darkMode ? 'black' : 'initial';
    // Simulate stimuli preview
    iframeDocument && simulateDisplay(previewStimuliItems, iframeDocument);
  }
}

/** Copied form trial.js */
function simulateDisplay(stimuliItems: StimuliItemToDisplay[][], container: Document) {
  simulateClear(container);
  forEach2d(stimuliItems, (stimuliItem, row, col) => {
    const contentEl = container.querySelector<HTMLDivElement>(`.spt-trial-content.spt-trial-content-${getDisplayKey(row, col)}`);
    if (contentEl) {
      if (stimuliItem !== null) {
        const textEl = contentEl.querySelector<HTMLDivElement>('.spt-trial-text');
        const imageEl = contentEl.querySelector<HTMLImageElement>('.spt-trial-image');
        if (stimuliItem.type === 'text') {
          if (textEl) textEl.style.visibility = '';
          if (textEl) textEl.innerHTML = stimuliItem.content;
          if (imageEl) imageEl.style.visibility = 'hidden';
          if (imageEl) imageEl.src = '';
        } else if (stimuliItem.type === 'image') {
          if (textEl) textEl.style.visibility = 'hidden';
          if (textEl) textEl.innerHTML = '';
          if (imageEl) imageEl.style.visibility = '';
          if (imageEl) imageEl.src = stimuliItem.content;
        }
        contentEl.style.display = '';
      }
    }
  })
}
function simulateClear(container: Document) {
  (container.querySelectorAll<HTMLDivElement>('.spt-trial-content')).forEach(contentEl => {
    const textEl = contentEl.querySelector<HTMLDivElement>('.spt-trial-text');
    const imageEl = contentEl.querySelector<HTMLImageElement>('.spt-trial-image');
    if (textEl) textEl.style.visibility = 'hidden';
    if (textEl) textEl.innerHTML = '';
    if (imageEl) imageEl.style.visibility = 'hidden';
    if (imageEl) imageEl.src = '';
    contentEl.style.display = 'none';
  })
}