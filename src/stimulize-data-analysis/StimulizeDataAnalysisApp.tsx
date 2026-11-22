import { Modal } from '@arco-design/web-react';
import { recordAction } from '../analytics/usage';
import React, { useState, useRef, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { getMissingRequiredVars, REQUIRED_CSV_VARS } from './constants';
import DataTab from './components/DataTab';
import AnalysisTab from './components/AnalysisTab';
import PlotTab from './components/PlotTab';
import { processData, applyDataCleaning } from './utils/dataProcessing';
import type {
  ActiveTab,
  AnalysisParams,
  CleaningOptions,
  CsvRow,
  DataFormat,
  PlotParams,
} from './types';
import './StimulizeDataAnalysisApp.css';

const defaultCleaningOptions: CleaningOptions = {
  removeIncompleteResponses: true,
  removeLowQualResponses: true,
  participantIqr: false,
  participantCustom: false,
  thresholdLower: 200,
  thresholdUpper: 800,
};

const defaultPlotParams: PlotParams = {
  title: 'Condition Comparison',
  color: '#87CEEB',
  xLabel: 'Condition',
  yLabel: 'Ratio',
  customYRange: false,
  yMin: 0,
  yMax: 1,
};

/** SP-Builder data analysis workflow (Data / Analysis / Plot tabs). */
export function StimulizeDataAnalysisApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data');
  const [rawData, setRawData] = useState<CsvRow[] | null>(null);
  const [selectedData, setSelectedData] = useState<CsvRow[] | null>(null);
  const [processedData, setProcessedData] = useState<CsvRow[] | null>(null);
  const [processedDataBeforeCleaning, setProcessedDataBeforeCleaning] = useState<CsvRow[] | null>(null);
  const [longFormatData, setLongFormatData] = useState<CsvRow[] | null>(null);
  const [confirmedVars, setConfirmedVars] = useState(false);
  const [dataReshaped, setDataReshaped] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showPlot, setShowPlot] = useState(false);

  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [format, setFormat] = useState<DataFormat>('Wide');
  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>({
    removeIncompleteResponses: true,
    removeLowQualResponses: true,
    participantIqr: false,
    participantCustom: false,
    thresholdLower: 200,
    thresholdUpper: 800
  });
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>({
    paradigm: 'AMP',
    type: 't-test',
  });
  const [plotParams, setPlotParams] = useState<PlotParams>(defaultPlotParams);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConfirmDisabled = !rawData || confirmedVars;
  const isProcessDisabled = !selectedData || !confirmedVars;
  const isDownloadDisabled = !processedData;

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          let data = results.data as CsvRow[];

          if (!data[0]?.ID) {
            data = data.slice(2).map((row, index) => ({
              ID: String(index + 1),
              ...row,
            }));
          }

          const ignoreVars = ['stimuliItems', 'timeline', 'primes'];
          const cleanedData = data.map((row) => {
            const newRow = { ...row };
            ignoreVars.forEach((varName) => {
              delete newRow[varName];
            });
            return newRow;
          });

          setRawData(cleanedData);
          if (cleanedData.length && results.errors.length === 0) recordAction('analysis_data_imported');
          setSelectedData(null);
          setProcessedData(null);
          setConfirmedVars(false);
          setDataReshaped(false);
          setShowAnalysis(false);
          setShowPlot(false);
          resetCleaningOptions();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          alert(`Error uploading file: ${message}`);
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleConfirmVars = () => {
    if (!rawData) return;

    const missingRequired = getMissingRequiredVars(Object.keys(rawData[0] || {}));
    if (missingRequired.length > 0) {
      setValidationError(
        `Your CSV is missing required variable(s):\n\n${missingRequired.join('\n')}\n\nPlease export from Qualtrics with all SP-Builder variables before confirming.`
      );
      return;
    }

    const allSelected = [...REQUIRED_CSV_VARS, ...selectedVars];

    const filteredData = rawData.map((row) => {
      const newRow: CsvRow = {};
      allSelected.forEach((var_) => {
        if (Object.prototype.hasOwnProperty.call(row, var_)) {
          newRow[var_] = row[var_];
        }
      });
      return newRow;
    });

    setSelectedData(filteredData);
    setConfirmedVars(true);
  };

  const handleProcessData = async () => {
    if (!selectedData) return;

    try {
      const { processedData: processed, longFormatData: longFormat } = await processData(selectedData, format);

      setProcessedData(processed);
      setProcessedDataBeforeCleaning(processed);
      setLongFormatData(longFormat);
      setDataReshaped(true);
      setShowAnalysis(false);
      setShowPlot(false);

      alert(`Data has been successfully converted to ${format} format with ${processed.length} rows.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Error processing data: ${message}`);
    }
  };

  const handleApplyCleaning = () => {
    if (!processedDataBeforeCleaning) return;

    try {
      const result = applyDataCleaning(processedDataBeforeCleaning, cleaningOptions, format);
      setProcessedData(result.cleanedData);

      if (result.longFormatData) {
        setLongFormatData(result.longFormatData);
      }

      setShowAnalysis(false);
      setShowPlot(false);
      alert(`Data cleaning completed. Rows remaining: ${result.cleanedData.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Error applying cleaning: ${message}`);
    }
  };

  const handleDownload = () => {
    if (!processedData) return;

    const csv = Papa.unparse(processedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `processed_data_${new Date().toISOString().split('T')[0]}.csv`);
    recordAction('processed_data_download_requested');
  };

  const resetCleaningOptions = () => {
    setCleaningOptions(defaultCleaningOptions);
  };

  const handleReset = () => {
    setRawData(null);
    setSelectedData(null);
    setProcessedData(null);
    setProcessedDataBeforeCleaning(null);
    setLongFormatData(null);
    setConfirmedVars(false);
    setDataReshaped(false);
    setShowAnalysis(false);
    setShowPlot(false);
    setSelectedVars([]);
    setFormat('Wide');
    resetCleaningOptions();
    setAnalysisParams({ paradigm: 'AMP', type: 't-test' });
    setPlotParams(defaultPlotParams);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    alert('All data and settings have been reset. You can now upload a new dataset.');
  };

  return (
    <div className="stimulize-data-analysis-root">
      <Modal
        visible={validationError !== null}
        title="Missing required variables"
        okText="OK"
        hideCancel
        onOk={() => setValidationError(null)}
        onCancel={() => setValidationError(null)}
      >
        <p style={{ whiteSpace: 'pre-line', margin: 0, textAlign: 'left' }}>{validationError}</p>
      </Modal>
      <div className="app">
        <div className="tab-container">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <span className="step-number">1</span> Data
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              <span className="step-number">2</span> Analysis
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'plot' ? 'active' : ''}`}
              onClick={() => setActiveTab('plot')}
            >
              <span className="step-number">3</span> Plot
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'data' && (
              <DataTab
                rawData={rawData}
                selectedData={selectedData}
                processedData={processedData}
                selectedVars={selectedVars}
                setSelectedVars={setSelectedVars}
                format={format}
                setFormat={setFormat}
                cleaningOptions={cleaningOptions}
                setCleaningOptions={setCleaningOptions}
                confirmedVars={confirmedVars}
                dataReshaped={dataReshaped}
                isConfirmDisabled={isConfirmDisabled}
                isProcessDisabled={isProcessDisabled}
                isDownloadDisabled={isDownloadDisabled}
                fileInputRef={fileInputRef}
                onFileUpload={handleFileUpload}
                onConfirmVars={handleConfirmVars}
                onProcessData={handleProcessData}
                onApplyCleaning={handleApplyCleaning}
                onDownload={handleDownload}
                onReset={handleReset}
              />
            )}

            {activeTab === 'analysis' && (
              <AnalysisTab
                longFormatData={longFormatData}
                analysisParams={analysisParams}
                setAnalysisParams={setAnalysisParams}
                showAnalysis={showAnalysis}
                setShowAnalysis={setShowAnalysis}
              />
            )}

            {activeTab === 'plot' && (
              <PlotTab
                longFormatData={longFormatData}
                plotParams={plotParams}
                setPlotParams={setPlotParams}
                showPlot={showPlot}
                setShowPlot={setShowPlot}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
