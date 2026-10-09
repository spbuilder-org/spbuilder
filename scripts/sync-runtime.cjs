const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const target = path.join(root, 'src/assets/qsfTemplate.json');
const original = fs.readFileSync(target, 'utf8');
const runtime = ['page-flow.js', 'trial.js'].map(file => fs.readFileSync(path.join(root, 'runtime', file), 'utf8')).join('\n');
const qsf = JSON.parse(original);
const question = qsf.SurveyElements.find(e => e.PrimaryAttribute === 'QID2');
if (process.argv.includes('--check')) {
  if (question.Payload.QuestionJS !== runtime) throw new Error('Run npm run sync:runtime before building.');
} else {
  // Preserve legacy QSF formatting and slash escaping; replace only the trial script.
  const scripts = [...original.matchAll(/"QuestionJS":\s*("(?:\\.|[^"\\])*")/g)];
  const match = scripts.find(m => JSON.parse(m[1]) === question.Payload.QuestionJS);
  if (!match) throw new Error('Cannot find trial script in template');
  fs.writeFileSync(target, original.slice(0, match.index) + '"QuestionJS": ' + JSON.stringify(runtime).replace(/\//g, '\\/') + original.slice(match.index + match[0].length));
}
