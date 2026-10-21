// Read-only release check. Scripts are installed by manual Qualtrics paste/test/export.
const fs = require('node:fs');
const path = require('node:path');
const template = require('../src/assets/qsfTemplate.json');
const root = path.resolve(process.env.AMP_QUALTRICS_SOURCE || '../amp-qualtrics');
let stale = false;
for (const [id, filename] of [['QID1','load.js'], ['QID2','trial.js']]) {
  const embedded = template.SurveyElements.find(e => e.PrimaryAttribute === id).Payload.QuestionJS;
  const source = fs.readFileSync(path.join(root, 'src', filename), 'utf8');
  const normalize = text => text.replace(/\r\n/g, '\n').trim();
  if (normalize(embedded) !== normalize(source)) {
    stale = true;
    console.error(`${id}: ${filename} differs from the imported Qualtrics template.`);
  }
}
if (stale) {
  console.error('Paste both source scripts into the Qualtrics template experiment, test, export QSF, and replace src/assets/qsfTemplate.json. No files were changed.');
  process.exitCode = 1;
} else console.log('Imported Qualtrics scripts match the runtime source. Hosted survey testing must still be verified separately.');
