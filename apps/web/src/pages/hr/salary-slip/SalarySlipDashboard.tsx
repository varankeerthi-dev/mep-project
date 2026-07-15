import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { FileText, Settings, Banknote, List, CalendarDays } from 'lucide-react'

// Import Subcomponents (We will implement these next)
import { SalarySlipOverview } from './components/SalarySlipOverview'
import { SalarySlipVariables } from './components/SalarySlipVariables'
import { SalarySlipLoans } from './components/SalarySlipLoans'

export function SalarySlipDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'variables' | 'loans' | 'history'>('overview')

  const tabStyle = (isActive: boolean) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    fontWeight: isActive ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px'
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>Salary Slip & Payroll</h1>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <CardContent style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
            <div 
              style={tabStyle(activeTab === 'overview')} 
              onClick={() => setActiveTab('overview')}
            >
              <List size={16} /> Summary & Generation
            </div>
            <div 
              style={tabStyle(activeTab === 'variables')} 
              onClick={() => setActiveTab('variables')}
            >
              <Banknote size={16} /> Variable Pay (Daily/Monthly)
            </div>
            <div 
              style={tabStyle(activeTab === 'loans')} 
              onClick={() => setActiveTab('loans')}
            >
              <Settings size={16} /> Loans & Config
            </div>
            <div 
              style={tabStyle(activeTab === 'history')} 
              onClick={() => setActiveTab('history')}
            >
              <CalendarDays size={16} /> Past Runs
            </div>
          </div>
          
          <div style={{ padding: '24px' }}>
            {activeTab === 'overview' && <SalarySlipOverview />}
            {activeTab === 'variables' && <SalarySlipVariables />}
            {activeTab === 'loans' && <SalarySlipLoans />}
            {activeTab === 'history' && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <FileText size={48} style={{ margin: '0 auto', opacity: 0.2, marginBottom: '16px' }} />
                <h3>History Module</h3>
                <p>View locked payroll runs and historical slips here.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
