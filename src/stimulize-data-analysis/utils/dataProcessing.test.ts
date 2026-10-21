import { processData } from './dataProcessing';

const legacy = {sptResponses:'d', sptResponseDurations:'123', shuffleResult:'1', primeResult:''};
test.each([
  {timeline:JSON.stringify({advanced:true,pages:[]})},
  {sptResponsesArray:JSON.stringify([[['d',null]]])},
  {sptPoolSelectionArray:JSON.stringify([[[{A1:1}]]])},
  {sptDisplayedPages:'1'},
  {sptResponses:'d/TIMEOUT'},
])('legacy analysis rejects advanced data without a version flag: %j', async (extra) => {
  await expect(processData([{...legacy,...extra}], 'wide' as any)).rejects.toThrow('Advanced page results');
});
test('two-dimensional legacy response arrays remain supported', async () => {
  await expect(processData([{...legacy,sptResponsesArray:'[["d"]]'}], 'wide' as any)).resolves.toBeDefined();
});
