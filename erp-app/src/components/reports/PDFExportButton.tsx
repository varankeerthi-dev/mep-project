import { useState } from 'react';
import { 
  ArrowDownTrayIcon, 
  EyeIcon, 
  DocumentArrowDownIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';
import { usePDFGeneration } from '../../hooks/usePDFGeneration';
import { GeneratedReport } from '../../reports/api';

interface PDFExportButtonProps {
  reportData: GeneratedReport;
  reportContent?: any;
  reportType?: 'general' | 'financial' | 'project';
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  reportData,
  reportContent,
  reportType = 'general',
  disabled = false,
  className = '',
  size = 'md',
  variant = 'primary'
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const { generatePDF, generateFinancialPDF, generateProjectPDF, state } = usePDFGeneration();

  const handleGeneratePDF = async (options: {
    download?: boolean;
    openInNewTab?: boolean;
    filename?: string;
  }) => {
    if (!reportContent) return;

    try {
      switch (reportType) {
        case 'financial':
          await generateFinancialPDF(reportData, reportContent, options);
          break;
        case 'project':
          await generateProjectPDF(reportData, reportContent, options);
          break;
        default:
          await generatePDF(reportData, reportContent, options);
          break;
      }
      setShowOptions(false);
    } catch (error) {
      console.error('PDF generation failed:', error);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-zinc-600 text-white hover:bg-zinc-700 disabled:bg-zinc-400';
      case 'outline':
        return 'border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 disabled:bg-zinc-100 disabled:text-zinc-500';
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400';
    }
  };

  const baseClasses = `
    inline-flex items-center gap-2 rounded-lg font-medium transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    disabled:cursor-not-allowed
    ${getSizeClasses()}
    ${getVariantClasses()}
    ${className}
  `;

  if (state.isGenerating) {
    return (
      <div className={baseClasses}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span>Generating PDF... {state.progress}%</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled || !reportContent}
        className={baseClasses}
        title="Export PDF"
      >
        <ArrowDownTrayIcon className="w-4 h-4" />
        <span>Export PDF</span>
      </button>

      {showOptions && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowOptions(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg border border-zinc-200 shadow-lg z-20">
            <div className="p-2">
              {/* Quick Actions */}
              <div className="space-y-1">
                <button
                  onClick={() => handleGeneratePDF({ download: true })}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-md transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 text-zinc-500" />
                  <div className="text-left">
                    <div className="font-medium">Download PDF</div>
                    <div className="text-xs text-zinc-500">Save to your device</div>
                  </div>
                </button>

                <button
                  onClick={() => handleGeneratePDF({ openInNewTab: true })}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-md transition-colors"
                >
                  <EyeIcon className="w-4 h-4 text-zinc-500" />
                  <div className="text-left">
                    <div className="font-medium">Open in New Tab</div>
                    <div className="text-xs text-zinc-500">Preview before downloading</div>
                  </div>
                </button>

                <button
                  onClick={() => handleGeneratePDF({ download: true, openInNewTab: true })}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-md transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4 text-zinc-500" />
                  <div className="text-left">
                    <div className="font-medium">Download & Open</div>
                    <div className="text-xs text-zinc-500">Save and preview</div>
                  </div>
                </button>
              </div>

              <div className="border-t border-zinc-200 my-2"></div>

              {/* Custom Filename */}
              <div className="px-3 py-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Custom Filename
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`${reportData.report_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`}
                    className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleGeneratePDF({ 
                            download: true, 
                            filename: input.value.trim() + '.pdf' 
                          });
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleGeneratePDF({ 
                          download: true, 
                          filename: input.value.trim() + '.pdf' 
                        });
                      }
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Export
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-200 my-2"></div>

              {/* Advanced Options */}
              <button
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-md transition-colors"
                disabled
              >
                <Cog6ToothIcon className="w-4 h-4 text-zinc-500" />
                <div className="text-left">
                  <div className="font-medium">Advanced Options</div>
                  <div className="text-xs text-zinc-500">Coming soon</div>
                </div>
              </button>
            </div>

            {/* Error Display */}
            {state.error && (
              <div className="border-t border-zinc-200 p-3 bg-red-50">
                <div className="text-sm text-red-700">
                  {state.error}
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {state.isGenerating && (
              <div className="border-t border-zinc-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-zinc-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${state.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm text-zinc-600 min-w-[3rem] text-right">
                    {state.progress}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PDFExportButton;
