import React, { useState } from 'react'
import { Input, Button } from '@/components/ui'
import { Save } from 'lucide-react'

export function SalarySlipVariables() {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Entry Date</span>
          <Input 
            type="date" 
            value={entryDate} 
            onChange={(e) => setEntryDate(e.target.value)}
            style={{ width: '150px', height: '32px' }}
          />
        </div>
        <Button style={{ height: '32px', marginLeft: 'auto' }}>
          <Save size={14} style={{ marginRight: '6px' }} /> Save Changes
        </Button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Emp No</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Food</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Convenience</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Bonus</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Settled Independently?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                Fetch data to enter variable pay.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
