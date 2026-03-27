import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import CreateNonBillableDC from './CreateNonBillableDC';

type NonBillableDCEditProps = {
  dcId: string
  onCancel: () => void
}

export default function NonBillableDCEdit({ dcId, onCancel }: NonBillableDCEditProps) {
  const [editDC, setEditDC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDC();
  }, [dcId]);

  const loadDC = async () => {
    const { data } = await supabase
      .from('delivery_challans')
      .select('*')
      .eq('id', dcId)
      .single();
    setEditDC(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!editDC) return <div>Non-Billable DC not found</div>;

  return <CreateNonBillableDC editDC={editDC} onSuccess={onCancel} onCancel={onCancel} />;
}
