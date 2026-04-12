import { PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui';
import { Eye, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ProGridInvoiceDocument } from './pro-grid-invoice-document';
import { getInvoiceDisplayNumber } from './ui-utils';

export interface InvoiceItem {
  id?: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  rate: number;
  amount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  unit?: string;
}

export interface InvoiceWithRelations {
  id: string;
  invoice_number?: string;
  invoice_prefix?: string;
  invoice_date?: string;
  quotation_ref?: string;
  due_date?: string;
  po_number?: string;
  terms_conditions?: string;
  invoice_items?: InvoiceItem[];
}

interface Organisation {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  logo_url?: string;
  bank_details?: {
    bank_name?: string;
    account_no?: string;
    ifsc?: string;
    branch?: string;
  };
}

interface Client {
  client_name: string;
  gstin?: string;
  state?: string;
  billing_address?: string;
}

interface ProGridInvoiceButtonProps {
  invoice: InvoiceWithRelations;
  organisation: Organisation;
  client: Client;
  variant?: 'button' | 'icon';
  label?: string;
  showLabel?: boolean;
}

export const ProGridInvoiceButton: React.FC<ProGridInvoiceButtonProps> = ({
  invoice,
  organisation,
  client,
  variant = 'button',
  label = 'Download PDF',
  showLabel = true,
}) => {
  const [loading, setLoading] = useState(false);

  if (!invoice) {
    return null;
  }

  const fileName = `invoice_${invoice.invoice_number || getInvoiceDisplayNumber({ id: invoice.id })}_${new Date().toISOString().split('T')[0]}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ProGridInvoiceDocument
          invoice={invoice}
          organisation={organisation}
          client={client}
        />
      }
      fileName={fileName}
      className={variant === 'icon' ? '' : 'no-underline'}
      onClick={() => setLoading(true)}
    >
      {({ loading: pdfLoading }) => {
        if (variant === 'icon') {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full text-zinc-500 hover:bg-gray-100 hover:text-zinc-700"
              disabled={pdfLoading}
              title={label}
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
          );
        }
        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={pdfLoading}
            className="gap-2"
          >
            {pdfLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {showLabel && label}
              </>
            )}
          </Button>
        );
      }}
    </PDFDownloadLink>
  );
};

export const ProGridInvoicePreview: React.FC<ProGridInvoiceButtonProps> = ({
  invoice,
  organisation,
  client,
  label = 'Preview',
}) => {
  if (!invoice) {
    return null;
  }

  return (
    <PDFDownloadLink
      document={
        <ProGridInvoiceDocument
          invoice={invoice}
          organisation={organisation}
          client={client}
        />
      }
      fileName={`preview_${invoice.invoice_number || getInvoiceDisplayNumber({ id: invoice.id })}.pdf`}
      className="no-underline"
    >
      {({ loading }) => (
        <Button variant="ghost" size="sm" disabled={loading} className="gap-2">
          <Eye className="w-4 h-4" />
          {label}
        </Button>
      )}
    </PDFDownloadLink>
  );
};