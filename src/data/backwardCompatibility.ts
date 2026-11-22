import type { AmpParams } from './ampTypes';
import { emptyAmpParams } from './emptyAmpParams';
import { getUidCounter, setUidCounter } from './uid';

export function transformOldValues(values: AmpParams) {
  if (typeof values.trialHtml !== 'string') {
    if (values.trialHtml.text !== undefined) {
      values.trialHtml.instruction = values.trialHtml.text;
      values.trialHtml.text = undefined;
    }
    values.trialHtml.textFontSize ??= 28;
    values.trialHtml.textIsBold ??= true;
    values.trialHtml.textWrap ??= true;
    values.trialHtml.darkMode ??= false;
  } else {
    // Move string-type trialHtml into trialHtml.customHtml, and fill the config with default values
    values.trialHtml = {
      ...emptyAmpParams.trialHtml,
      customHtml: values.trialHtml,
    };
  }

  // Old values do not have uidCounter. Set to 1000 to avoid collision.
  if (typeof values.uidCounter === 'number') {
    setUidCounter(values.uidCounter);
  } else {
    setUidCounter(1000);
  }
}

export function transformValuesOnSave({ values }: { values: AmpParams }) {
  return {
    values: {
      ...values,
      uidCounter: getUidCounter(),
    },
  };
}
