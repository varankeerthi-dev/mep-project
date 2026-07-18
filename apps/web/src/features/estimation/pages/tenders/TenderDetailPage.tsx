import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTender, useDeleteTenderDocument } from '../../hooks/useTenders';
import { PermissionGuard } from '../../../../rbac';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink, Trash2 } from 'lucide-react';

export default function TenderDetailPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();
  const { data: tender, isLoading } = useTender(id || null);
  const deleteDocument = useDeleteTenderDocument();

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!tender) return <div className="p-6 text-red-500">Tender not found</div>;

  const marginIcon = tender.expected_margin != null
    ? tender.expected_margin >= 15
      ? <TrendingUp className="h-5 w-5 text-green-500" />
      : tender.expected_margin >= 5
        ? <Minus className="h-5 w-5 text-amber-500" />
        : <TrendingDown className="h-5 w-5 text-red-500" />
    : null;

  const documents = (tender as any).documents || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/estimation/tenders')} className="p-1.5 hover:bg-zinc-100 rounded">
            <ArrowLeft className="h-5 w-5 text-zinc-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-800">{tender.tender_no}</h1>
            {tender.title && <p className="text-sm text-zinc-500">{tender.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            tender.status === 'Won' ? 'bg-green-100 text-green-700' :
            tender.status === 'Lost' ? 'bg-red-100 text-red-700' :
            tender.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
            'bg-zinc-100 text-zinc-600'
          }`}>{tender.status}</span>
          <PermissionGuard permission="estimation.tender.update">
            <button
              onClick={() => navigate(`/estimation/tenders/edit?id=${id}`)}
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50"
            >
              Edit
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Bid Amount</p>
              <p className="text-lg font-semibold text-zinc-800">
                {tender.bid_amount ? `₹${Number(tender.bid_amount).toLocaleString()}` : '-'}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Estimated Cost</p>
              <p className="text-lg font-semibold text-zinc-800">
                {tender.estimated_cost ? `₹${Number(tender.estimated_cost).toLocaleString()}` : '-'}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-1">Expected Margin</p>
              <div className="flex items-center gap-2">
                {marginIcon}
                <p className="text-lg font-semibold text-zinc-800">
                  {tender.expected_margin != null ? `${tender.expected_margin}%` : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            <div className="grid grid-cols-2 gap-4 p-4">
              <div>
                <p className="text-xs text-zinc-500">Client</p>
                <p className="text-sm font-medium text-zinc-700">{(tender as any).client?.client_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Linked BOQ</p>
                <p className="text-sm font-medium text-zinc-700">{(tender as any).boq?.boq_no || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Submission Date</p>
                <p className="text-sm font-medium text-zinc-700">
                  {tender.submission_date ? new Date(tender.submission_date).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Decision Date</p>
                <p className="text-sm font-medium text-zinc-700">
                  {tender.decision_date ? new Date(tender.decision_date).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
            {tender.result_notes && (
              <div className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-700">{tender.result_notes}</p>
              </div>
            )}
            {tender.win_loss_reason && (
              <div className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Win/Loss Reason</p>
                <p className="text-sm text-zinc-700">{tender.win_loss_reason}</p>
              </div>
            )}
            {tender.loa_reference && (
              <div className="p-4">
                <p className="text-xs text-zinc-500 mb-1">LOA Reference</p>
                <p className="text-sm font-medium text-zinc-700">{tender.loa_reference}</p>
              </div>
            )}
          </div>

          {documents.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg">
              <div className="px-4 py-3 border-b border-zinc-100">
                <h3 className="font-medium text-zinc-800">Documents ({documents.length})</h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded text-zinc-600">{doc.document_type?.replace('_', ' ')}</span>
                      <span className="text-sm text-zinc-700">{doc.file_name || 'Unnamed'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-1 hover:bg-zinc-100 rounded text-zinc-400">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => { if (confirm('Delete this document?')) deleteDocument.mutate({ id: doc.id!, tenderId: id! }); }}
                        className="p-1 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
