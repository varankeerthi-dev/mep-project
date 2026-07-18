import { useAuth } from '../../../App';
import { usePartners } from '../hooks/usePartners';

type PartnerSelectProps = {
  value: string;
  onChange: (partnerId: string) => void;
  label?: string;
};

export default function PartnerSelect({ value, onChange, label }: PartnerSelectProps) {
  const { organisation } = useAuth();
  const { data: partners, isLoading } = usePartners({
    organisation_id: organisation?.id || '',
    is_active: true,
  });

  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}
      >
        <option value="">Not referred</option>
        {isLoading ? (
          <option disabled>Loading...</option>
        ) : (
          partners?.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.business_name}{p.contact_person ? ` (${p.contact_person})` : ''}{p.phone ? ` — ${p.phone}` : ''}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
