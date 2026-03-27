import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import CreateDC from './CreateDC';

type DCEditProps = {
  dcId: string
  onCancel: () => void
}

export default function DCEdit({ dcId, onCancel }: DCEditProps) {
  const [editDC, setEditDC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDC();
  }, [dcId]);

  const loadDC = async () => {
    const { data } = await supabase.from('delivery_challans').select('*').eq('id', dcId).single();
    setEditDC(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!editDC) return <div>DC not found</div>;

  return <CreateDC editDC={editDC} onSuccess={() => onCancel()} onCancel={onCancel} />;
}
