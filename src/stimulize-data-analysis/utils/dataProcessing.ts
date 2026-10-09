// @ts-nocheck — dynamic CSV columns; exported functions are typed for callers.
import type { AnalysisResult, CleaningOptions, CsvRow, DataFormat, TTestResult } from '../types';

// Main data processing function
export const processData = async (
  data: CsvRow[],
  format: DataFormat
): Promise<{ processedData: CsvRow[]; longFormatData: CsvRow[] | null }> => {
  if (!data || data.length === 0) {
    throw new Error('No data provided');
  }

  if (data.some(row => String(row.sptPageDataVersion ?? '') === '1')) {
    throw new Error('Concurrent/conditional page results are not supported by this legacy analysis. Use sptPageResults, which records the actual pools, items, responses and timings; shuffleResult is not a trial-to-stimulus mapping for these experiments.');
  }
  let processedData = [...data];

  // Ensure ID exists
  processedData = processedData.map((row, index) => ({
    ID: row.ID || (index + 1),
    ...row
  }));

  // Check for required columns
  const requiredCols = ['sptResponses', 'shuffleResult', 'sptResponseDurations', 'primeResult'];
  const missingCols = requiredCols.filter(col => !processedData[0]?.hasOwnProperty(col));
  
  if (missingCols.length > 0) {
    throw new Error(`Missing required columns: ${missingCols.join(', ')}`);
  }

  // Process sptResponses
  let maxCols = 0;
  if (processedData[0]?.sptResponses) {
    maxCols = Math.max(...processedData.map(row => 
      row.sptResponses ? row.sptResponses.split(',').length : 0
    ));
    
    processedData = processedData.map(row => {
      if (row.sptResponses) {
        const responses = row.sptResponses.split(',');
        const newRow = { ...row };
        for (let i = 0; i < maxCols; i++) {
          newRow[`sptResponse_Trial_${i + 1}`] = responses[i] || '';
        }
        return newRow;
      }
      return row;
    });
  }

  // Process shuffleResult
  if (processedData[0]?.shuffleResult) {
    processedData = processedData.map(row => {
      if (row.shuffleResult) {
        const shuffleParts = row.shuffleResult.split(';');
        const newRow = { ...row };
        newRow.shuffleStimuli1 = shuffleParts[0] || '';
        newRow.shuffleStimuli2 = shuffleParts[1] || '';
        newRow.shuffleStimuli3 = shuffleParts[2] || '';
        
        // Process shuffleStimuli1 into trial columns
        if (newRow.shuffleStimuli1) {
          const stimuli = newRow.shuffleStimuli1.split(',');
          for (let i = 0; i < maxCols; i++) {
            newRow[`ShuffleResult_Trial_${i + 1}`] = stimuli[i] || '';
          }
        }
        
        return newRow;
      }
      return row;
    });
  }

  // Process sptResponseDurations
  if (processedData[0]?.sptResponseDurations) {
    processedData = processedData.map(row => {
      if (row.sptResponseDurations) {
        const durations = row.sptResponseDurations.split(',');
        const newRow = { ...row };
        for (let i = 0; i < maxCols; i++) {
          newRow[`sptResponseDuration_Trial_${i + 1}`] = durations[i] || '';
        }
        return newRow;
      }
      return row;
    });
  }

  // Process primeResult
  if (processedData[0]?.primeResult) {
    processedData = processedData.map(row => {
      if (row.primeResult) {
        const primeParts = row.primeResult.split(';');
        const newRow = { ...row };
        newRow.primeResult1 = primeParts[0] ? primeParts[0].replace(/.*=/, '') : '';
        newRow.primeResult2 = primeParts[1] ? primeParts[1].replace(/.*=/, '') : '';
        return newRow;
      }
      return row;
    });
  }

  // Process ShuffleResult based on primeResult1
  const shuffleColumns = Object.keys(processedData[0] || {}).filter(col => 
    col.startsWith('ShuffleResult_Trial_')
  );
  
  if (shuffleColumns.length > 0 && processedData[0]?.primeResult1) {
    processedData = processedData.map(row => {
      const newRow = { ...row };
      shuffleColumns.forEach(col => {
        newRow[col] = (row[col] === row.primeResult1) ? '1' : '0';
      });
      return newRow;
    });
  }

  // Create long format data (following R script logic)
  let longFormatData = null;
  const trialColumns = [
    ...Object.keys(processedData[0] || {}).filter(col => col.startsWith('sptResponse_Trial_')),
    ...Object.keys(processedData[0] || {}).filter(col => col.startsWith('ShuffleResult_Trial_')),
    ...Object.keys(processedData[0] || {}).filter(col => col.startsWith('sptResponseDuration_Trial_'))
  ];

  if (trialColumns.length > 0) {
    longFormatData = [];
    
    processedData.forEach(row => {
      // Get unique trial numbers from all trial columns
      const trialNumbers = [...new Set(
        trialColumns.map(col => {
          const match = col.match(/_Trial_(\d+)$/);
          return match ? match[1] : null;
        }).filter(Boolean)
      )].sort((a, b) => parseInt(a) - parseInt(b));
      
      trialNumbers.forEach((trialNum, index) => {
        const longRow = {
          ID: row.ID,
          trial: trialNum,
          record: index + 1
        };
        
        // Add non-trial columns (exclude original raw columns and trial columns)
        const excludeColumns = new Set([
          'sptResponses', 'shuffleResult', 'sptResponseDurations', 'primeResult',
          'shuffleStimuli1', 'shuffleStimuli2', 'shuffleStimuli3',
          ...trialColumns
        ]);
        
        Object.keys(row).forEach(key => {
          if (!excludeColumns.has(key)) {
            longRow[key] = row[key];
          }
        });
        
        // Add trial-specific columns with their base names
        const trialSuffix = `_Trial_${trialNum}`;
        if (row[`sptResponse${trialSuffix}`] !== undefined) {
          longRow.sptResponse = row[`sptResponse${trialSuffix}`];
        }
        if (row[`ShuffleResult${trialSuffix}`] !== undefined) {
          longRow.ShuffleResult = row[`ShuffleResult${trialSuffix}`];
        }
        if (row[`sptResponseDuration${trialSuffix}`] !== undefined) {
          longRow.sptResponseDuration = row[`sptResponseDuration${trialSuffix}`];
        }
        
        longFormatData.push(longRow);
      });
    });
    
    // Filter out rows with empty sptResponse (following R script logic)
    longFormatData = longFormatData.filter(row => 
      row.sptResponse !== undefined && row.sptResponse !== null && row.sptResponse !== ''
    );
  }

  // Return appropriate format
  const finalData = format === 'Long' && longFormatData ? longFormatData : processedData;
  
  return {
    processedData: finalData,
    longFormatData: longFormatData
  };
};

// Data cleaning function
export const applyDataCleaning = (
  data: CsvRow[],
  cleaningOptions: CleaningOptions,
  format: DataFormat = 'Wide'
): { cleanedData: CsvRow[]; longFormatData: CsvRow[] | null } => {
  if (!data || data.length === 0) {
    throw new Error('No data provided for cleaning');
  }

  let cleanedData = [...data];
  const originalCount = cleanedData.length;

  // Remove incomplete responses (keep only rows where Progress == 100)
  if (cleaningOptions.removeIncompleteResponses) {
    const beforeCount = cleanedData.length;
    cleanedData = cleanedData.filter(row => {
      const progressKey = Object.keys(row).find(key => key.toLowerCase() === 'progress');
      if (!progressKey) return true; // If Progress column doesn't exist, keep the row
      const progress = parseFloat(row[progressKey]);
      return !isNaN(progress) && progress === 100;
    });
    console.log(`Incomplete responses filter: ${beforeCount} -> ${cleanedData.length} rows`);
  }

  // Remove low quality responses (participants who select same option for all trials)
  if (cleaningOptions.removeLowQualResponses) {
    const beforeCount = cleanedData.length;
    const sptResponseColumns = Object.keys(cleanedData[0] || {}).filter(key => 
      key.startsWith('sptResponse_Trial_')
    );
    
    if (sptResponseColumns.length > 0) {
      cleanedData = cleanedData.filter(row => {
        const responses = sptResponseColumns
          .map(col => row[col])
          .filter(val => val !== undefined && val !== null && val !== '');
        
        if (responses.length === 0) return true; // Keep if no responses
        
        // Count unique responses
        const uniqueResponses = new Set(responses);
        return uniqueResponses.size > 1; // Keep only if more than 1 unique response
      });
    }
    console.log(`Low quality responses filter: ${beforeCount} -> ${cleanedData.length} rows`);
  }

  // IQR filtering
  if (cleaningOptions.participantIqr) {
    const beforeCount = cleanedData.length;
    // Find duration column (could be 'Duration..in.seconds.' or similar)
    const durationKey = Object.keys(cleanedData[0] || {}).find(key => 
      key.toLowerCase().includes('duration') && key.toLowerCase().includes('second')
    );
    
    if (durationKey) {
      const durations = cleanedData
        .map(row => parseFloat(row[durationKey]))
        .filter(d => !isNaN(d))
        .sort((a, b) => a - b);
      
      if (durations.length > 0) {
        const q1Index = Math.floor(durations.length * 0.25);
        const q3Index = Math.floor(durations.length * 0.75);
        const q1 = durations[q1Index];
        const q3 = durations[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        cleanedData = cleanedData.filter(row => {
          const duration = parseFloat(row[durationKey]);
          return !isNaN(duration) && duration >= lowerBound && duration <= upperBound;
        });
      }
    }
    console.log(`IQR filter: ${beforeCount} -> ${cleanedData.length} rows`);
  }

  // Custom filtering
  if (cleaningOptions.participantCustom) {
    const beforeCount = cleanedData.length;
    // Find duration column
    const durationKey = Object.keys(cleanedData[0] || {}).find(key => 
      key.toLowerCase().includes('duration') && key.toLowerCase().includes('second')
    );
    
    if (durationKey) {
      cleanedData = cleanedData.filter(row => {
        const duration = parseFloat(row[durationKey]);
        return !isNaN(duration) && 
               duration >= cleaningOptions.thresholdLower && 
               duration <= cleaningOptions.thresholdUpper;
      });
    }
    console.log(`Custom filter: ${beforeCount} -> ${cleanedData.length} rows`);
  }

  // Regenerate long format data from cleaned wide data (following R script logic)
  const trialColumns = [
    ...Object.keys(cleanedData[0] || {}).filter(col => col.startsWith('sptResponse_Trial_')),
    ...Object.keys(cleanedData[0] || {}).filter(col => col.startsWith('ShuffleResult_Trial_')),
    ...Object.keys(cleanedData[0] || {}).filter(col => col.startsWith('sptResponseDuration_Trial_'))
  ];

  let longFormatData = null;
  if (trialColumns.length > 0) {
    longFormatData = [];
    
    cleanedData.forEach(row => {
      // Get unique trial numbers from all trial columns
      const trialNumbers = [...new Set(
        trialColumns.map(col => {
          const match = col.match(/_Trial_(\d+)$/);
          return match ? match[1] : null;
        }).filter(Boolean)
      )].sort((a, b) => parseInt(a) - parseInt(b));
      
      trialNumbers.forEach((trialNum, index) => {
        const longRow = {
          ID: row.ID,
          trial: trialNum,
          record: index + 1
        };
        
        // Add non-trial columns (exclude original raw columns and trial columns)
        const excludeColumns = new Set([
          'sptResponses', 'shuffleResult', 'sptResponseDurations', 'primeResult',
          'shuffleStimuli1', 'shuffleStimuli2', 'shuffleStimuli3',
          ...trialColumns
        ]);
        
        Object.keys(row).forEach(key => {
          if (!excludeColumns.has(key)) {
            longRow[key] = row[key];
          }
        });
        
        // Add trial-specific columns with their base names
        const trialSuffix = `_Trial_${trialNum}`;
        if (row[`sptResponse${trialSuffix}`] !== undefined) {
          longRow.sptResponse = row[`sptResponse${trialSuffix}`];
        }
        if (row[`ShuffleResult${trialSuffix}`] !== undefined) {
          longRow.ShuffleResult = row[`ShuffleResult${trialSuffix}`];
        }
        if (row[`sptResponseDuration${trialSuffix}`] !== undefined) {
          longRow.sptResponseDuration = row[`sptResponseDuration${trialSuffix}`];
        }
        
        longFormatData.push(longRow);
      });
    });
    
    // Filter out rows with empty sptResponse
    longFormatData = longFormatData.filter(row => 
      row.sptResponse !== undefined && row.sptResponse !== null && row.sptResponse !== ''
    );
  }

  // If no cleaning options are selected, return original data
  if (!cleaningOptions.removeIncompleteResponses && 
      !cleaningOptions.removeLowQualResponses &&
      !cleaningOptions.participantIqr && 
      !cleaningOptions.participantCustom) {
    console.log('No cleaning options selected, returning original data');
    return { cleanedData: data, longFormatData: null };
  }

  console.log(`Total cleaning: ${originalCount} -> ${cleanedData.length} rows`);
  
  return {
    cleanedData: format === 'Long' && longFormatData ? longFormatData : cleanedData,
    longFormatData: longFormatData
  };
};

// Enhanced t-test function for use with performAnalysis results
export const performTTest = (longFormatData: CsvRow[]): { summary: AnalysisResult['summary']; tTestResult: TTestResult } => {
  // Use performAnalysis to get the processed data, then run t-test
  const analysisResults = performAnalysis(longFormatData);
  
  if (!analysisResults.summary || analysisResults.summary.length === 0) {
    throw new Error('No analysis data available for t-test');
  }

  // Extract ratios for t-test
  const targetRatios = analysisResults.summary.map(r => r.target_ratio).filter(r => !isNaN(r));
  const controlRatios = analysisResults.summary.map(r => r.control_ratio).filter(r => !isNaN(r));

  if (targetRatios.length === 0 || controlRatios.length === 0) {
    throw new Error('Insufficient data for t-test');
  }

  const tTestResult = tTest(targetRatios, controlRatios);

  return {
    summary: analysisResults.summary,
    tTestResult: tTestResult
  };
};

// Paired t-test implementation (following R script update)
const tTest = (sample1, sample2) => {
  const n1 = sample1.length;
  const n2 = sample2.length;
  
  if (n1 === 0 || n2 === 0) {
    throw new Error('Cannot perform t-test with empty samples');
  }
  
  if (n1 !== n2) {
    throw new Error('Paired t-test requires equal sample sizes');
  }

  const n = n1; // Since they're equal for paired test
  const mean1 = sample1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = sample2.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate differences for paired t-test
  const differences = sample1.map((val, i) => val - sample2[i]);
  const meanDiff = differences.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate standard deviation of differences
  const varianceDiff = differences.reduce((sum, val) => sum + Math.pow(val - meanDiff, 2), 0) / (n - 1);
  const standardError = Math.sqrt(varianceDiff / n);
  
  const tStatistic = meanDiff / standardError;
  const degreesOfFreedom = n - 1; // Correct df for paired t-test
  
  // Calculate p-value using t-distribution approximation
  const pValue = 2 * (1 - tDistribution(Math.abs(tStatistic), degreesOfFreedom));

  return {
    mean1,
    mean2,
    meanDifference: meanDiff,
    tStatistic: tStatistic,
    degreesOfFreedom: degreesOfFreedom,
    pValue: Math.max(0, Math.min(1, pValue)),
    method: "Paired t-test"
  };
};

// Improved t-distribution CDF using beta distribution
const tDistribution = (t, df) => {
  // Use Hill's algorithm for incomplete beta function (more accurate)
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  
  if (t >= 0) {
    return 1 - 0.5 * incompleteBeta(x, a, b);
  } else {
    return 0.5 * incompleteBeta(x, a, b);
  }
};

// Improved incomplete beta function implementation
const incompleteBeta = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  // Use continued fraction approximation (more accurate than simple power approximation)
  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  const f = continuedFraction(a, b, x);
  return front * f;
};

// Log gamma function approximation
const lnGamma = (x) => {
  // Lanczos approximation
  const coef = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953
  ];
  
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  
  for (let j = 0; j < 6; j++) {
    ser += coef[j] / ++y;
  }
  
  return -tmp + Math.log(2.5066282746310005 * ser / x);
};

// Continued fraction for incomplete beta
const continuedFraction = (a, b, x, maxIterations = 200, epsilon = 1e-10) => {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    
    if (Math.abs(del - 1) < epsilon) break;
  }
  
  return h;
};

// Enhanced analysis function following R script logic
export const performAnalysis = (longFormatData: CsvRow[]): AnalysisResult => {
  if (!longFormatData || longFormatData.length === 0) {
    throw new Error('No long format data provided for analysis');
  }

  // Check if necessary columns exist
  const requiredCols = ['ID', 'sptResponse', 'ShuffleResult'];
  const missingCols = requiredCols.filter(col => !longFormatData[0]?.hasOwnProperty(col));
  
  if (missingCols.length > 0) {
    throw new Error(`Missing columns needed for analysis: ${missingCols.join(', ')}`);
  }

  try {
    // Group by ID, sptResponse, ShuffleResult and count occurrences
    const grouped = {};
    
    longFormatData.forEach(row => {
      if (row.sptResponse !== undefined && row.sptResponse !== null && row.sptResponse !== '') {
        const key = `${row.ID}_${row.sptResponse}_${row.ShuffleResult}`;
        grouped[key] = (grouped[key] || 0) + 1;
      }
    });

    // Convert to table format
    const table1 = [];
    Object.keys(grouped).forEach(key => {
      const [ID, sptResponse, ShuffleResult] = key.split('_');
      table1.push({
        ID: ID,
        sptResponse: sptResponse,
        ShuffleResult: ShuffleResult,
        count: grouped[key]
      });
    });

    // Pivot wider to get k_control, d_control, k_target, d_target columns
    // ShuffleResult: 1 = target condition, 0 = control condition
    const pivoted = {};
    table1.forEach(row => {
      if (!pivoted[row.ID]) {
        pivoted[row.ID] = { ID: row.ID };
      }
      const condition = row.ShuffleResult === '1' || row.ShuffleResult === 1 ? 'target' : 'control';
      const colName = `${row.sptResponse === 'k' ? 'k' : 'd'}_${condition}`;
      pivoted[row.ID][colName] = row.count;
    });

    // Convert to array and fill missing values with 0
    const table1clean = Object.values(pivoted).map(row => ({
      ID: row.ID,
      k_control: row.k_control || 0,
      d_control: row.d_control || 0,
      k_target: row.k_target || 0,
      d_target: row.d_target || 0
    }));

    // Calculate ratios
    const analysisData = table1clean.map(row => ({
      ...row,
      target_ratio: row.k_target / (row.k_target + row.d_target),
      control_ratio: row.k_control / (row.k_control + row.d_control)
    }));

    return {
      summary: analysisData,
      stats: calculateSummaryStats(analysisData)
    };
  } catch (error) {
    throw new Error(`Error in analysis: ${error.message}`);
  }
};

// Calculate summary statistics
const calculateSummaryStats = (data) => {
  if (data.length === 0) return null;

  const targetRatios = data.map(row => row.target_ratio).filter(val => !isNaN(val));
  const controlRatios = data.map(row => row.control_ratio).filter(val => !isNaN(val));

  const targetMean = targetRatios.reduce((a, b) => a + b, 0) / targetRatios.length;
  const controlMean = controlRatios.reduce((a, b) => a + b, 0) / controlRatios.length;
  
  const targetSD = Math.sqrt(targetRatios.reduce((sum, val) => sum + Math.pow(val - targetMean, 2), 0) / targetRatios.length);
  const controlSD = Math.sqrt(controlRatios.reduce((sum, val) => sum + Math.pow(val - controlMean, 2), 0) / controlRatios.length);

  return {
    target: {
      mean: targetMean,
      sd: targetSD,
      n: targetRatios.length
    },
    control: {
      mean: controlMean,
      sd: controlSD,
      n: controlRatios.length
    }
  };
};
