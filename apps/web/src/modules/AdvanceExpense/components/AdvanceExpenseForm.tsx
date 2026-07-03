import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateAdvanceExpense, useUpdateAdvanceExpense, useSubmitForApproval, useExpenseCategories, useOrgEmployees, useProjects, useAdvanceExpenses } from '../hooks/useAdvanceExpense';
import { validateAeForm } from '../utils/validation';
import { supabase } from '../../../lib/supabase';
import type { AeFormData, AeType, AeRequestType, AePayoutMethod } from '../types';

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '12px',
};

const LABEL_STYLE: React.CSSProperties = {
  width: '70px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  flexShrink: 0,
};

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: '12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  outline: 'none',
  background: '#fff',
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: 'auto',
};

const DROPDOWN_WRAPPER: React.CSSProperties = {
  position: 'relative',
  flex: 1,
};

const DROPDOWN_LIST: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 50,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
};

const DROPDOWN_ITEM: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '12px',
  cursor: 'pointer',
  borderBottom: '1px solid #f0f0f0',
};

interface Props {
  editId?: string | null;
  onClose: () => void;
}

export const AdvanceExpenseForm: React.FC<Props> = ({ editId, onClose }) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const createMutation = useCreateAdvanceExpense();
  const updateMutation = useUpdateAdvanceExpense();
  const submitMutation = useSubmitForApproval();

  const { data: categories = [] } = useExpenseCategories(orgId);
  const { data: employees = [] } = useOrgEmployees(orgId);
  const { data: projects = [] } = useProjects(orgId);
  const { data: advancesList = [] } = useAdvanceExpenses(orgId, { type: 'ADVANCE', status: 'APPROVED' });

  const [form, setForm] = useState<AeFormData>({
    type: 'EXPENSE',
    request_type: 'REIMBURSEMENT',
    employee_id: '',
    project_id: '',
    category_id: '',
    amount: 0,
    payout_method: 'IMMEDIATE',
    narration: '',
    remarks: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  useEffect(() => {
    if (editId) {
      supabase.from('advances_expenses').select('*').eq('id', editId).single().then(({ data }) => {
        if (data) {
          setForm({
            type: data.type,
            request_type: data.request_type || 'REIMBURSEMENT',
            employee_id: data.employee_id || '',
            project_id: data.project_id || '',
            category_id: data.category_id || '',
            amount: Number(data.amount),
            payout_method: data.payout_method || 'IMMEDIATE',
            advance_id: data.advance_id || undefined,
            float_id: data.float_id || undefined,
            narration: data.narration || '',
            remarks: data.remarks || '',
          });
        }
      });
    }
  }, [editId]);

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredEmployees = employees.filter((e: any) =>
    (e.full_name || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );
  const filteredProjects = projects.filter((p: any) =>
    (p.name || '').toLowerCase().includes(projectSearch.toLowerCase())
  );

  const selectedCat = categories.find((c: any) => c.id === form.category_id);
  const selectedEmp = employees.find((e: any) => e.user_id === form.employee_id);
  const selectedProj = projects.find((p: any) => p.id === form.project_id);

  const handleSave = async (submitAfter = false) => {
    const errs = validateAeForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, data: form });
      } else {
        const result = await createMutation.mutateAsync(form);
        if (submitAfter && result?.id) {
          await submitMutation.mutateAsync(result.id);
        }
      }
      onClose();
    } catch (e) {
      // handled by mutation
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '600px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', marginBottom: '20px' }}>
        {editId ? 'Edit Entry' : 'New Entry'}
      </h2>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Type</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as AeType })}
          style={SELECT_STYLE}
        >
          <option value="ADVANCE">Advance</option>
          <option value="EXPENSE">Expense</option>
          <option value="REIMBURSEMENT">Reimbursement</option>
        </select>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Req Type</label>
        <select
          value={form.request_type}
          onChange={(e) => setForm({ ...form, request_type: e.target.value as AeRequestType })}
          style={SELECT_STYLE}
        >
          <option value="REIMBURSEMENT">Already Spent (Reimbursement)</option>
          <option value="PRE_APPROVAL">Need Money (Pre-Approval)</option>
        </select>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Employee</label>
        <div style={DROPDOWN_WRAPPER}>
          <input
            placeholder="Search employee..."
            value={employeeOpen ? employeeSearch : selectedEmp?.full_name || ''}
            onFocus={() => setEmployeeOpen(true)}
            onChange={(e) => { setEmployeeSearch(e.target.value); setEmployeeOpen(true); }}
            style={INPUT_STYLE}
          />
          {employeeOpen && (
            <div style={DROPDOWN_LIST}>
              {filteredEmployees.map((e: any) => (
                <div
                  key={e.user_id}
                  style={{ ...DROPDOWN_ITEM, background: form.employee_id === e.user_id ? '#EFF6FF' : '#fff' }}
                  onClick={() => { setForm({ ...form, employee_id: e.user_id }); setEmployeeOpen(false); setEmployeeSearch(''); }}
                >
                  {e.full_name || e.email}
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.employee_id && <span style={{ color: '#EF4444', fontSize: '11px' }}>{errors.employee_id}</span>}
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Project</label>
        <div style={DROPDOWN_WRAPPER}>
          <input
            placeholder="Search project..."
            value={projectOpen ? projectSearch : selectedProj?.name || ''}
            onFocus={() => setProjectOpen(true)}
            onChange={(e) => { setProjectSearch(e.target.value); setProjectOpen(true); }}
            style={INPUT_STYLE}
          />
          {projectOpen && (
            <div style={DROPDOWN_LIST}>
              {filteredProjects.map((p: any) => (
                <div
                  key={p.id}
                  style={{ ...DROPDOWN_ITEM, background: form.project_id === p.id ? '#EFF6FF' : '#fff' }}
                  onClick={() => { setForm({ ...form, project_id: p.id }); setProjectOpen(false); setProjectSearch(''); }}
                >
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.project_id && <span style={{ color: '#EF4444', fontSize: '11px' }}>{errors.project_id}</span>}
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Category</label>
        <div style={DROPDOWN_WRAPPER}>
          <input
            placeholder="Search category..."
            value={categoryOpen ? categorySearch : selectedCat?.name || ''}
            onFocus={() => setCategoryOpen(true)}
            onChange={(e) => { setCategorySearch(e.target.value); setCategoryOpen(true); }}
            style={INPUT_STYLE}
          />
          {categoryOpen && (
            <div style={DROPDOWN_LIST}>
              {filteredCategories.map((c: any) => (
                <div
                  key={c.id}
                  style={{ ...DROPDOWN_ITEM, background: form.category_id === c.id ? '#EFF6FF' : '#fff' }}
                  onClick={() => { setForm({ ...form, category_id: c.id }); setCategoryOpen(false); setCategorySearch(''); }}
                >
                  {c.name} {c.account_code ? `(${c.account_code})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.category_id && <span style={{ color: '#EF4444', fontSize: '11px' }}>{errors.category_id}</span>}
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Amount</label>
        <input
          type="number"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          style={INPUT_STYLE}
          min={0}
          step={0.01}
        />
        {errors.amount && <span style={{ color: '#EF4444', fontSize: '11px' }}>{errors.amount}</span>}
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Payout</label>
        <select
          value={form.payout_method}
          onChange={(e) => setForm({ ...form, payout_method: e.target.value as AePayoutMethod })}
          style={SELECT_STYLE}
        >
          <option value="IMMEDIATE">Immediate</option>
          <option value="WITH_SALARY">With Salary</option>
        </select>
      </div>

      {(form.type === 'EXPENSE' || form.type === 'REIMBURSEMENT') && (
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>Link Advance</label>
          <select
            value={form.advance_id || ''}
            onChange={(e) => setForm({ ...form, advance_id: e.target.value || undefined })}
            style={SELECT_STYLE}
          >
            <option value="">None (standalone)</option>
            {advancesList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.transaction_no} - {a.employee_name} - ₹{Number(a.amount).toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Narration</label>
        <textarea
          value={form.narration}
          onChange={(e) => setForm({ ...form, narration: e.target.value })}
          style={{ ...INPUT_STYLE, minHeight: '60px', resize: 'vertical' }}
        />
        {errors.narration && <span style={{ color: '#EF4444', fontSize: '11px' }}>{errors.narration}</span>}
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Remarks</label>
        <textarea
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          style={{ ...INPUT_STYLE, minHeight: '60px', resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button onClick={onClose} style={{
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#374151',
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button onClick={() => handleSave(false)} style={{
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#fff',
          background: '#185FA5',
          border: '1px solid #185FA5',
          borderRadius: '6px',
          cursor: 'pointer',
        }}>
          Save Draft
        </button>
        <button onClick={() => handleSave(true)} style={{
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#fff',
          background: '#059669',
          border: '1px solid #059669',
          borderRadius: '6px',
          cursor: 'pointer',
        }}>
          Submit for Approval
        </button>
      </div>
    </div>
  );
};
