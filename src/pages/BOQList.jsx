import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBOQList } from '../api';

export default function BOQList() {
  const navigate = useNavigate();
  const [boqs, setBoqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchBOQList();
        if (active) setBoqs(data || []);
      } catch (error) {
        console.error('Error loading BOQ list:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return boqs;
    return boqs.filter((boq) => {
      const no = String(boq.boq_no || '').toLowerCase();
      const rev = String(boq.revision_no || '').toLowerCase();
      const client = String(boq.client?.client_name || '').toLowerCase();
      const project = String(boq.project?.project_name || '').toLowerCase();
      return no.includes(term) || rev.includes(term) || client.includes(term) || project.includes(term);
    });
  }, [boqs, search]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>BOQ</h1>
          <div className="page-subtitle">All BOQ list with BOQ No & Revision No</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/boq/create')}>
          Create BOQ
        </button>
      </div>

      <div className="card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search by BOQ No, Revision, Client, Project..."
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '420px' }}
          />
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {filtered.length} BOQ{filtered.length === 1 ? '' : 's'}
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>BOQ No</th>
                  <th style={{ width: '120px' }}>Revision No</th>
                  <th style={{ width: '120px' }}>Date</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                      No BOQs found
                    </td>
                  </tr>
                ) : filtered.map((boq) => (
                  <tr key={boq.id}>
                    <td style={{ fontWeight: 600 }}>{boq.boq_no || '-'}</td>
                    <td>{boq.revision_no ?? '-'}</td>
                    <td>{boq.boq_date || '-'}</td>
                    <td>{boq.client?.client_name || '-'}</td>
                    <td>{boq.project?.project_name || '-'}</td>
                    <td>
                      <span className={`badge ${boq.status === 'Approved' ? 'badge-success' : 'badge-neutral'}`}>
                        {boq.status || 'Draft'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => navigate(`/boq/create?editId=${boq.id}`)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
