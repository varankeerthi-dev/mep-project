import { useState, useEffect } from 'react';
import { useAuth } from '../../../../App';
import { supabase } from '../../../../supabase';
import { RefreshCcw } from 'lucide-react';
import { SubcontractorForm } from './SubcontractorForm';

const getCurrentQueryParams = () => new URLSearchParams(window.location.search);

interface SubcontractorEditProps {
  onNavigate: (path: string) => void;
}

export function SubcontractorEdit({ onNavigate }: SubcontractorEditProps) {
  const { organisation } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const id = getCurrentQueryParams().get('id');
  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode && organisation?.id) {
      setLoading(true);
      supabase
        .from('subcontractors')
        .select('*')
        .eq('id', id)
        .eq('organisation_id', organisation.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setSub(data);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [id, organisation?.id, isEditMode]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCcw className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (isEditMode && !sub) {
    return (
      <div className="p-6 text-center text-red-500">
        Subcontractor not found or access denied.
      </div>
    );
  }

  return (
    <SubcontractorForm
      editMode={isEditMode}
      subData={sub}
      onSuccess={() => onNavigate('/subcontractors-v2')}
      onCancel={() => onNavigate('/subcontractors-v2')}
    />
  );
}
export default SubcontractorEdit;
