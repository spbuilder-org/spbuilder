import { recordAction } from '../../analytics/usage';
import React, { useState } from 'react';
import { performAnalysis, performTTest } from '../utils/dataProcessing';
import type { AnalysisParams, AnalysisResult, CsvRow } from '../types';

export interface AnalysisTabProps {
  longFormatData: CsvRow[] | null;
  analysisParams: AnalysisParams;
  setAnalysisParams: React.Dispatch<React.SetStateAction<AnalysisParams>>;
  showAnalysis: boolean;
  setShowAnalysis: React.Dispatch<React.SetStateAction<boolean>>;
}

const AnalysisTab: React.FC<AnalysisTabProps> = ({
  longFormatData,
  analysisParams,
  setAnalysisParams,
  showAnalysis,
  setShowAnalysis
}) => {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParamChange = (param: keyof AnalysisParams, value: string) => {
    setAnalysisParams({
      ...analysisParams,
      [param]: value
    });
  };

  const handleGenerateAnalysis = () => {
    if (!longFormatData || longFormatData.length === 0) {
      setError('No data available for analysis. Please process data in the Data tab first.');
      return;
    }

    try {
      // Use the enhanced performAnalysis function that matches R script
      const analysisResults = performAnalysis(longFormatData);
      
      // Add t-test results if needed
      if (analysisParams.type === 't-test' && analysisResults.summary.length > 0) {
        const tTestResult = performTTest(longFormatData);
        analysisResults.tTestResult = tTestResult.tTestResult;
      }
      
      setAnalysisResults(analysisResults);
      if (analysisResults.summary.length) recordAction('analysis_completed');
      setShowAnalysis(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Error in analysis: ${message}`);
      setAnalysisResults(null);
    }
  };

  // Remove duplicate formatSummaryTable - use stats from performAnalysis instead

  const renderSummary = () => {
    if (!showAnalysis) {
      return <p>Click 'Generate Analysis' to view the summary.</p>;
    }

    if (error) {
      return <p className="error">{error}</p>;
    }

    if (!analysisResults || !analysisResults.summary) {
      return <p>No analysis results available.</p>;
    }

    const { summary, stats } = analysisResults;
    
    if (!stats) {
      return <p>Unable to generate summary statistics.</p>;
    }

    return (
      <div className="summary-stats">
        <h5>Summary Statistics</h5>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Number of Participants</td>
              <td>{summary.length}</td>
            </tr>
            <tr>
              <td>Target Ratio Mean</td>
              <td>{stats.target.mean.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Target Ratio SD</td>
              <td>{isNaN(stats.target.sd) ? 'N/A' : stats.target.sd.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Control Ratio Mean</td>
              <td>{stats.control.mean.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Control Ratio SD</td>
              <td>{isNaN(stats.control.sd) ? 'N/A' : stats.control.sd.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        
        <h5>Individual Participant Data</h5>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>k_control</th>
                <th>d_control</th>
                <th>k_target</th>
                <th>d_target</th>
                <th>Target Ratio</th>
                <th>Control Ratio</th>
              </tr>
            </thead>
            <tbody>
              {summary.slice(0, 20).map((row, index) => (
                <tr key={index}>
                  <td>{row.ID}</td>
                  <td>{row.k_control}</td>
                  <td>{row.d_control}</td>
                  <td>{row.k_target}</td>
                  <td>{row.d_target}</td>
                  <td>{isNaN(row.target_ratio) ? 'N/A' : row.target_ratio.toFixed(2)}</td>
                  <td>{isNaN(row.control_ratio) ? 'N/A' : row.control_ratio.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.length > 20 && (
            <p>Showing first 20 rows of {summary.length} total participants</p>
          )}
        </div>
      </div>
    );
  };

  const renderAnalysis = () => {
    if (!showAnalysis) {
      return <p>Click 'Generate Analysis' to view the statistical analysis.</p>;
    }

    if (error) {
      return <p className="error">{error}</p>;
    }

    if (!analysisResults || !analysisResults.tTestResult) {
      return <p>No statistical analysis results available.</p>;
    }

    const { tTestResult } = analysisResults;

    return (
      <div className="analysis-results">
        <h5>Paired t-Test Results</h5>
        <div className="test-results">
          <table className="stats-table">
            <tbody>
              <tr>
                <td><strong>Target Condition Mean:</strong></td>
                <td>{tTestResult.mean1.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Control Condition Mean:</strong></td>
                <td>{tTestResult.mean2.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Mean Difference:</strong></td>
                <td>{tTestResult.meanDifference ? tTestResult.meanDifference.toFixed(2) : (tTestResult.mean1 - tTestResult.mean2).toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>t-statistic:</strong></td>
                <td>{tTestResult.tStatistic.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Degrees of Freedom:</strong></td>
                <td>{tTestResult.degreesOfFreedom}</td>
              </tr>
              <tr>
                <td><strong>p-value (two-tailed):</strong></td>
                <td>{tTestResult.pValue.toFixed(6)}</td>
              </tr>
            </tbody>
          </table>
          
          <div className="interpretation">
            <h6>Interpretation:</h6>
            <p>
              {tTestResult.pValue < 0.05 
                ? `The difference between conditions is statistically significant (p < 0.05).`
                : `The difference between conditions is not statistically significant (p ≥ 0.05).`
              }
            </p>
            <p>
              <strong>Note:</strong> This analysis uses a simplified t-test implementation. 
              For publication-quality results, please verify using dedicated statistical software.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analysis-tab">
      <div className="sidebar">
        <div className="section">
          <h4>Analysis Settings</h4>
          <label>
            Paradigm:
            <select 
              value={analysisParams.paradigm}
              onChange={(e) => handleParamChange('paradigm', e.target.value)}
            >
              <option value="AMP">AMP</option>
              <option value="Go/No-Go">Go/No-Go</option>
            </select>
          </label>
        </div>

        <div className="section">
          <label>
            Statistical Method:
            <select 
              value={analysisParams.type}
              onChange={(e) => handleParamChange('type', e.target.value)}
            >
              <option value="t-test">t-test</option>
            </select>
          </label>
        </div>

        <div className="section">
          <h4>Conditions</h4>
          <div className="condition-info">
            <p>
              <strong>Target condition 
                <span className="tooltip-icon" data-tooltip="Trials where the target stimulus is presented and evaluated.">ⓘ</span>
              </strong>
            </p>
            <p className="help-text">Trials where the target stimulus is presented and evaluated.</p>
            
            <p>
              <strong>Control condition 
                <span className="tooltip-icon" data-tooltip="Trials using a neutral or comparison stimulus to serve as a baseline.">ⓘ</span>
              </strong>
            </p>
            <p className="help-text">Trials using a neutral or comparison stimulus to serve as a baseline.</p>
          </div>
        </div>

        <div className="section">
          <button 
            className="btn btn-primary"
            onClick={handleGenerateAnalysis}
          >
            Generate Results
          </button>
        </div>
      </div>

      <div className="main-panel">
        <div className="analysis-content">
          <div className="analysis-section">
            <h4>Statistical Analysis</h4>
            {renderAnalysis()}
          </div>

          <div className="summary-section">
            <h4>Summary Statistics</h4>
            {renderSummary()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisTab;
