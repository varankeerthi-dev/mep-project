import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GeneratedReport } from '../reports/api';
import { 
  generateReportPDF, 
  generateFinancialReportPDF, 
  generateProjectReportPDF,
  downloadPDF,
  openPDFInNewTab 
} from '../utils/pdfGenerator';

interface PDFGenerationState {
  isGenerating: boolean;
  progress: number;
  error: string | null;
}

interface UsePDFGenerationReturn {
  generatePDF: (
    reportData: GeneratedReport,
    reportContent: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => Promise<void>;
  generateFinancialPDF: (
    reportData: GeneratedReport,
    financialData: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => Promise<void>;
  generateProjectPDF: (
    reportData: GeneratedReport,
    projectData: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => Promise<void>;
  state: PDFGenerationState;
}

export const usePDFGeneration = (): UsePDFGenerationReturn => {
  const { organisation } = useAuth();
  const [state, setState] = useState<PDFGenerationState>({
    isGenerating: false,
    progress: 0,
    error: null
  });

  const updateState = useCallback((updates: Partial<PDFGenerationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const generatePDFHandler = useCallback(async (
    reportData: GeneratedReport,
    reportContent: any,
    pdfGenerator: (data: GeneratedReport, content: any, orgName: string) => Promise<Blob>,
    options: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    } = {}
  ) => {
    if (!organisation?.name) {
      updateState({ error: 'Organization information not available' });
      return;
    }

    let progressInterval: NodeJS.Timeout;

    try {
      updateState({ isGenerating: true, progress: 0, error: null });

      // Simulate progress updates
      progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 100);

      // Generate PDF
      const pdfBlob = await pdfGenerator(reportData, reportContent, organisation.name);
      
      clearInterval(progressInterval);
      updateState({ progress: 100 });

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = options.filename || 
        `${reportData.report_name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;

      // Handle output options
      if (options.download !== false) {
        downloadPDF(pdfBlob, filename);
      }

      if (options.openInNewTab) {
        openPDFInNewTab(pdfBlob);
      }

      // Update report status in database
      await updateReportStatus(reportData.id, 'completed', {
        file_path: filename,
        file_size: pdfBlob.size,
        file_format: 'pdf'
      });

      setTimeout(() => {
        updateState({ isGenerating: false, progress: 0 });
      }, 1000);

    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      updateState({ 
        isGenerating: false, 
        progress: 0, 
        error: error instanceof Error ? error.message : 'Failed to generate PDF' 
      });
    }
  }, [organisation?.name, updateState]);

  const generatePDF = useCallback((
    reportData: GeneratedReport,
    reportContent: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => {
    return generatePDFHandler(reportData, reportContent, generateReportPDF, options);
  }, [generatePDFHandler]);

  const generateFinancialPDF = useCallback((
    reportData: GeneratedReport,
    financialData: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => {
    return generatePDFHandler(reportData, financialData, generateFinancialReportPDF, options);
  }, [generatePDFHandler]);

  const generateProjectPDF = useCallback((
    reportData: GeneratedReport,
    projectData: any,
    options?: {
      download?: boolean;
      openInNewTab?: boolean;
      filename?: string;
    }
  ) => {
    return generatePDFHandler(reportData, projectData, generateProjectReportPDF, options);
  }, [generatePDFHandler]);

  return {
    generatePDF,
    generateFinancialPDF,
    generateProjectPDF,
    state
  };
};

// Helper function to update report status
async function updateReportStatus(
  reportId: string, 
  status: GeneratedReport['status'], 
  data?: Partial<GeneratedReport>
) {
  try {
    const { supabase } = await import('../supabase');
    const updateData: Partial<GeneratedReport> = { status, ...data };

    const { error } = await supabase
      .from('generated_reports')
      .update(updateData)
      .eq('id', reportId);

    if (error) {
      console.error('Failed to update report status:', error);
    }
  } catch (error) {
    console.error('Error updating report status:', error);
  }
}

export default usePDFGeneration;
