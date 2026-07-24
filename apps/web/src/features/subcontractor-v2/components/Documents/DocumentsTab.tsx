import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { FileText, Plus, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from '../../hooks/queryKeys';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';

interface DocumentsTabProps {
  subcontractorId?: string | null;
  onNavigate?: (path: string) => void;
}

export function DocumentsTab({ subcontractorId, onNavigate }: DocumentsTabProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [subId, setSubId] = useState(subcontractorId || '');
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (subcontractorId) {
      setSubId(subcontractorId);
    }
  }, [subcontractorId]);

  useEffect(() => {
    if (organisation?.id && !subcontractorId) {
      supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('company_name')
        .then(({ data }) => setSubcontractors(data || []));
    }
  }, [organisation?.id, subcontractorId]);

  const loadDocuments = async () => {
    if (subId && organisation?.id) {
      setLoadingDocs(true);
      const { data } = await supabase
        .from('subcontractor_documents')
        .select('*')
        .eq('subcontractor_id', subId)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      setDocuments(data || []);
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (subId) {
      loadDocuments();
    }
  }, [subId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!subId || !organisation?.id) return;
    setUploading(true);

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileName = `sub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { data, error } = await supabase.storage
          .from('subcontractor-documents')
          .upload(fileName, new Uint8Array(arrayBuffer), { contentType: file.type });

        if (!error && data) {
          const { data: urlData } = supabase.storage.from('subcontractor-documents').getPublicUrl(fileName);
          await supabase.from('subcontractor_documents').insert({
            organisation_id: organisation.id,
            subcontractor_id: subId,
            document_name: file.name,
            document_url: urlData.publicUrl,
            document_type: file.type
          });
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    setUploading(false);
    loadDocuments();
    queryClient.invalidateQueries({ queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.documents(subId) });
  };

  const isGeneralView = !subcontractorId;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl animate-none">
        {isGeneralView && (
          <>
            <div className="mb-10 flex items-center justify-between">
              <h1 className="text-3xl font-black tracking-tight text-zinc-900">Document Vault (V2)</h1>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('/subcontractors-v2')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}
          </>
        )}

        <div className={isGeneralView ? "rounded-[2.5rem] border border-zinc-200 bg-white p-10 shadow-xl shadow-zinc-200/50" : ""}>
          {isGeneralView && (
            <div className="mb-10 flex flex-wrap items-center gap-6">
              <div className="flex-1 min-w-[300px]">
                <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 ml-1 mb-2 block">Partner Selection</label>
                <select
                  className="h-14 w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-6 text-sm font-bold text-zinc-900 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                  value={subId}
                  onChange={e => setSubId(e.target.value)}
                >
                  <option value="">Select a partner to access vault...</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>
              {subId && (
                <div className="flex-none pt-6">
                  <label className="relative flex h-14 cursor-pointer items-center gap-3 rounded-2xl bg-blue-600 px-8 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95">
                    <Plus size={18} />
                    {uploading ? 'Archiving...' : 'Add Documents'}
                    <input type="file" className="hidden" multiple onChange={handleUpload} disabled={uploading} />
                  </label>
                </div>
              )}
            </div>
          )}

          {!isGeneralView && (
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900">Document Vault</h3>
              <label className="relative flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-6 text-xs font-semibold uppercase tracking-wider text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                <Plus size={16} />
                {uploading ? 'Archiving...' : 'Add Documents'}
                <input type="file" className="hidden" multiple onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          )}

          {!subId ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-zinc-300">
              <ShieldCheck size={48} className="opacity-20" />
              <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-50">Select Partner to Unlock Vault</p>
            </div>
          ) : loadingDocs ? (
            <div className="py-20 text-center text-zinc-400">Loading documents...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {documents.map(doc => (
                <div key={doc.id} className="group relative rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <FileText size={20} />
                  </div>
                  <div className="line-clamp-2 text-[13px] font-black text-zinc-900 leading-tight mb-4">{doc.document_name}</div>
                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800">
                    View Asset <ChevronRight size={14} />
                  </a>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No documents archived yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default DocumentsTab;
