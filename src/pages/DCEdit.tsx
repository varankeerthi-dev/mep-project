import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import CreateDC from './CreateDC';
import { useAuth } from '../App';

type DCEditProps = {
  dcId: string
  onCancel: () => void
}

export default function DCEdit({ dcId, onCancel }: DCEditProps) {
  const { organisation } = useAuth();
  const [editDC, setEditDC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDC();
  }, [dcId, organisation?.id]);

  const loadDC = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('delivery_challans').select('*').eq('id', dcId).eq('organisation_id', organisation.id).single();
    setEditDC(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!editDC) return <div>DC not found</div>;

  return <CreateDC editDC={editDC} onSuccess={() => onCancel()} onCancel={onCancel} />;
}
