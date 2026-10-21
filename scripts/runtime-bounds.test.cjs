const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const template = require('../src/assets/qsfTemplate.json');
const source = template.SurveyElements.find(e => e.PrimaryAttribute === 'QID2').Payload.QuestionJS;
const contentFunction = source.slice(source.indexOf('function getContent('), source.indexOf('\n\n\n', source.indexOf('function getContent(')));
function getContent(indexes) {
  const context = vm.createContext({
    pools: [{ shuffledIndexes: indexes, items: [{ type: 'text', content: 'A' }, { type: 'text', content: 'B' }] }],
    myGlobalThis: { preload: {} },
  });
  vm.runInContext(contentFunction, context);
  return context.getContent;
}
test('first draw of a one-count pool displays its stimulus', () => {
  assert.equal(getContent([0])(0, 0).content, 'A');
});
test('last valid draw is available and exhausted pools return empty', () => {
  for (const indexes of [[], [0], [0, 1], [0, 1, 0]]) {
    const draw = getContent(indexes);
    if (indexes.length) assert.equal(draw(0, indexes.length - 1).content, indexes.at(-1) ? 'B' : 'A');
    assert.equal(draw(0, indexes.length).type, 'empty');
  }
});
