import React from 'react'

export function SalarySlipLoans() {
  return (
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Active Loan Schedules</h3>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Employee Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Amount</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monthly EMI</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Remaining Balance</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                No active loans found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
