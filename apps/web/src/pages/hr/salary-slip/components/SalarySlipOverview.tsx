import React, { useState } from 'react'
import { Input, Button } from '@/components/ui'
import { FileDown, RefreshCw, Lock, AlertCircle, Info } from 'lucide-react'
import { useSalarySlipData } from '../../../../hooks/useSalarySlip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DailyBreakdown } from '../../../../utils/payrollCalculations'
import { toast } from 'sonner'

export function SalarySlipOverview() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const { data, isLoading, refetch, isFetching, isError } = useSalarySlipData(selectedMonth)

  const employeesData = data?.employees || []
  const isLocked = data?.isLocked || false

  const dashIfZero = (val: number | undefined, color?: string) => {
    if (!val || val === 0) {
      return <span style={{ color: color || '#d1d5db', fontWeight: 600 }}>-</span>
    }
    return <span style={{ color: color || 'inherit' }}>{Math.round(val).toLocaleString('en-IN')}</span>
  }

  const formatOT = (val: number | undefined) => {
    if (val === undefined) return '0.00'
    return val.toFixed(2)
  }

  const handleDownloadPayslip = (emp: any) => {
    try {
      // In a real app, this would trigger html2pdf or react-pdf.
      // For this implementation, we will use a browser print dialog targeted at a payslip view.
      toast.success(`Generating payslip for ${emp.name}...`)
      setTimeout(() => {
        window.print()
      }, 500)
    } catch (e) {
      toast.error('Failed to generate PDF')
    }
  }

  const totalNetPayout = employeesData.reduce((sum, emp) => sum + (emp.payroll?.salary.net || 0), 0)
  const displayMonth = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()

  if (isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#991b1b', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Failed to load payroll data</h3>
        <p style={{ color: '#b91c1c', marginBottom: '16px' }}>There was an error connecting to the database. Please try again.</p>
        <Button onClick={() => refetch()} style={{ backgroundColor: '#ef4444', color: 'white' }}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="salary-slip-container">
      {/* Hide print styles so only payslip prints, or hide dashboard during print */}
      <style>
        {`
          @media print {
            .salary-slip-container {
              display: none;
            }
          }
        `}
      </style>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Summary Grid</h2>
        
        {isLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
            <Lock size={12} /> Payroll Locked
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: '150px', height: '32px' }}
          />
          <Button variant="outline" style={{ height: '32px' }} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} /> {isFetching ? 'Fetching...' : 'Fetch Data'}
          </Button>
          <Button variant="outline" style={{ height: '32px', color: '#4f46e5', borderColor: '#e0e7ff' }}>
            <FileDown size={14} style={{ marginRight: '6px' }} /> Export CSV
          </Button>
          <Button style={{ height: '32px', backgroundColor: '#111827', color: 'white' }}>
            Columns
          </Button>
        </div>
      </div>
      
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ backgroundColor: '#dbeafe', color: '#1e3a8a', textAlign: 'center', padding: '6px', border: '1px solid #bfdbfe', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>BASIC INFO</th>
              <th colSpan={1} style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', textAlign: 'center', padding: '6px', border: '1px solid #e9d5ff', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>CTC</th>
              <th colSpan={8} style={{ backgroundColor: '#fef08a', color: '#854d0e', textAlign: 'center', padding: '6px', border: '1px solid #fde047', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>ATTENDANCE</th>
              <th colSpan={5} style={{ backgroundColor: '#bbf7d0', color: '#166534', textAlign: 'center', padding: '6px', border: '1px solid #86efac', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>EARNINGS (PAID)</th>
              <th colSpan={4} style={{ backgroundColor: '#fecaca', color: '#991b1b', textAlign: 'center', padding: '6px', border: '1px solid #fca5a5', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>DEDUCTIONS & VOUCHERS</th>
              <th colSpan={3} style={{ backgroundColor: '#16a34a', color: 'white', textAlign: 'center', padding: '6px', border: '1px solid #15803d', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '10px' }}>PAYOUT SUMMARY</th>
            </tr>
            <tr style={{ backgroundColor: '#ffffff', color: '#4b5563' }}>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600, width: '2%' }}>S.No</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 4px', fontSize: '10px', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Staff name</th>
              
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Total<br/>(CTC)</th>
              
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Total<br/>days</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Worked<br/>days</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Sun</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Sun<br/>wrk'd</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Hol<br/>wrk'd</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>OT<br/>hrs</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>LOP</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Paid<br/>days</th>

              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Earn<br/>(Paid)</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Sun<br/>pay</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Hol<br/>pay</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>OT<br/>pay</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Gross<br/>earn</th>

              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Loan</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Adv</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Exp</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Net<br/>(A-E)</th>

              <th style={{ border: '1px solid #e5e7eb', padding: '6px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 600 }}>Total<br/>deduct</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 4px', fontSize: '10px', textAlign: 'center', fontWeight: 600, backgroundColor: '#16a34a', color: 'white' }}>Net payout</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '6px 4px', fontSize: '10px', textAlign: 'center', fontWeight: 600, backgroundColor: '#16a34a', color: 'white' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={23} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  Loading salary data...
                </td>
              </tr>
            ) : employeesData.length === 0 ? (
              <tr>
                <td colSpan={23} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  No active employees found for this month.
                </td>
              </tr>
            ) : (
              employeesData.map((emp, index) => {
                const p = emp.payroll
                if (!p) return null
                
                const earningsColor = '#10b981' // Green
                const deductionsColor = '#ef4444' // Red
                
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
                    <td style={{ padding: '6px 2px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{index + 1}</td>
                    <td style={{ padding: '6px 4px', fontWeight: 600, borderRight: '1px solid #e5e7eb', color: '#111827', whiteSpace: 'nowrap' }}>{emp.name}</td>
                    
                    {/* CTC */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', borderRight: '1px solid #e5e7eb', color: '#9333ea' }}>
                      {dashIfZero(p.totalCTC)}
                    </td>
                    
                    {/* ATTENDANCE */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280' }}>{dashIfZero(p.totalDays)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280' }}>{dashIfZero(p.worked)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280' }}>{dashIfZero(p.sundays)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280' }}>{dashIfZero(p.sunW)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280' }}>{dashIfZero(p.holW)}</td>
                    
                    {/* OT Drill-down */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280', cursor: 'pointer' }}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: p.ot > 0 ? '#ca8a04' : '#d1d5db', textDecoration: p.ot > 0 ? 'underline' : 'none' }}>
                            {formatOT(p.ot)} {p.ot > 0 && <Info size={10} />}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent style={{ width: '300px', padding: '12px', fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                          <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>OT Breakdown</h4>
                          <table style={{ width: '100%' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th>Date</th>
                                <th>In</th>
                                <th>Out</th>
                                <th>OT (hrs)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.dailyBreakdown?.filter((d: DailyBreakdown) => d.otHours > 0).map((d: DailyBreakdown) => (
                                <tr key={d.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td>{new Date(d.date).getDate()}</td>
                                  <td>{d.checkIn || '-'}</td>
                                  <td>{d.checkOut || '-'}</td>
                                  <td style={{ fontWeight: 600, color: '#ca8a04' }}>{d.otHours.toFixed(2)}</td>
                                </tr>
                              ))}
                              {p.dailyBreakdown?.filter((d: DailyBreakdown) => d.otHours > 0).length === 0 && (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', padding: '8px' }}>No OT recorded.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </PopoverContent>
                      </Popover>
                    </td>

                    {/* LOP Drill-down */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#6b7280', cursor: 'pointer' }}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: p.lop > 0 ? '#ef4444' : '#d1d5db', textDecoration: p.lop > 0 ? 'underline' : 'none' }}>
                            {dashIfZero(p.lop)} {p.lop > 0 && <Info size={10} />}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent style={{ width: '250px', padding: '12px', fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                          <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>LOP Breakdown</h4>
                          <table style={{ width: '100%' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th>Date</th>
                                <th>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.dailyBreakdown?.filter((d: DailyBreakdown) => d.lop > 0).map((d: DailyBreakdown) => (
                                <tr key={d.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td>{new Date(d.date).getDate()}</td>
                                  <td style={{ color: '#ef4444' }}>{d.status}</td>
                                </tr>
                              ))}
                              {p.dailyBreakdown?.filter((d: DailyBreakdown) => d.lop > 0).length === 0 && (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: 'center', padding: '8px' }}>No LOP recorded.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </PopoverContent>
                      </Popover>
                    </td>

                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#111827', fontWeight: 500, borderRight: '1px solid #e5e7eb' }}>{dashIfZero(p.paidDays)}</td>
                    
                    {/* EARNINGS */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: earningsColor }}>{dashIfZero(p.basic + p.hra, earningsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: earningsColor }}>{dashIfZero(p.sunPay, earningsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: earningsColor }}>{dashIfZero(p.holPay, earningsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: earningsColor }}>{dashIfZero(p.otPay, earningsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: '#166534', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>{dashIfZero(p.totalEarnings, '#166534')}</td>
                    
                    {/* DEDUCTIONS */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: deductionsColor }}>{dashIfZero(p.loanE, deductionsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: deductionsColor }}>{dashIfZero(p.advanceAmount, deductionsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: deductionsColor }}>{dashIfZero(p.expenseAmount, deductionsColor)}</td>
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: deductionsColor, borderRight: '1px solid #e5e7eb' }}>{dashIfZero(p.netAdvanceExpense, deductionsColor)}</td>
                    
                    {/* SUMMARY */}
                    <td style={{ padding: '6px 2px', textAlign: 'center', color: 'white', backgroundColor: '#16a34a', borderRight: '1px solid #15803d', fontWeight: 500 }}>
                      {dashIfZero(p.totalDeductions, 'white')}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'left', paddingLeft: '8px', color: 'white', backgroundColor: '#16a34a', fontWeight: 700, fontSize: '11px' }}>
                      {dashIfZero(p.salary.net, 'white')}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#16a34a', borderLeft: '1px solid #15803d' }}>
                      <Button size="icon" variant="ghost" style={{ width: '24px', height: '24px', color: 'white', hover: { backgroundColor: '#15803d' } }} onClick={() => handleDownloadPayslip(emp)}>
                        <FileDown size={14} />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {!isLoading && !isError && employeesData.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={21} style={{ backgroundColor: '#111827', color: 'white', textAlign: 'right', padding: '12px 16px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.05em' }}>
                  GROSS ORGANIZATION PAYOUT FOR {displayMonth}
                </td>
                <td colSpan={2} style={{ backgroundColor: '#16a34a', color: 'white', textAlign: 'left', padding: '12px 16px', fontWeight: 700, fontSize: '14px' }}>
                  ₹{totalNetPayout.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
