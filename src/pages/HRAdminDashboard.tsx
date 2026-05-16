import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../App'
import {
  getAttendanceLogs,
  getSites,
  createSite,
  updateSite,
  type Attendance,
  type Site
} from '../supabase'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui'
import {
  FileText,
  Camera,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Download,
  Calendar,
  Users,
  Building2,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface NewSiteForm {
  site_name: string
  latitude: string
  longitude: string
  radius_meters: string
  address: string
}

const defaultSiteForm: NewSiteForm = {
  site_name: '',
  latitude: '',
  longitude: '',
  radius_meters: '100',
  address: ''
}

export default function HRAdminDashboard() {
  const { user, organisation } = useAuth()
  
  const [activeTab, setActiveTab] = useState('attendance')
  
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([])
  const [sites, setSites] = useState<Site[]>([])
  
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  
  const [siteForm, setSiteForm] = useState<NewSiteForm>(defaultSiteForm)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [savingSite, setSavingSite] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  
  const reportRef = useRef<HTMLDivElement>(null)

  const fetchAttendanceLogs = useCallback(async () => {
    if (!organisation?.id) return
    setLoading(true)
    try {
      const { data, error } = await getAttendanceLogs(organisation.id, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      if (error) throw error
      setAttendanceLogs(data || [])
    } catch (err) {
      console.error('Error fetching attendance:', err)
    } finally {
      setLoading(false)
    }
  }, [organisation?.id, dateRange.startDate, dateRange.endDate])

  const fetchSites = useCallback(async () => {
    if (!organisation?.id) return
    try {
      const { data, error } = await getSites(organisation.id)
      if (error) throw error
      setSites(data || [])
    } catch (err) {
      console.error('Error fetching sites:', err)
    }
  }, [organisation?.id])

  useEffect(() => {
    fetchAttendanceLogs()
    fetchSites()
  }, [fetchAttendanceLogs, fetchSites])

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      
      const doc = new jsPDF()
      
      doc.setFontSize(18)
      doc.text('Attendance Report', 14, 20)
      
      doc.setFontSize(10)
      doc.text(`Organization: ${organisation?.name || 'N/A'}`, 14, 30)
      doc.text(`Period: ${dateRange.startDate} to ${dateRange.endDate}`, 14, 36)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42)
      
      let yPos = 55
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Employee', 14, yPos)
      doc.text('Site', 60, yPos)
      doc.text('Check In', 100, yPos)
      doc.text('Check Out', 130, yPos)
      doc.text('Status', 165, yPos)
      
      doc.setFont('helvetica', 'normal')
      yPos += 8
      
      for (const log of attendanceLogs) {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        
        const employeeName = (log.employee as any)?.full_name || log.employee_id?.slice(0, 8) || 'Unknown'
        const siteName = log.site?.site_name || '-'
        const checkIn = log.check_in_time 
          ? new Date(log.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '-'
        const checkOut = log.check_out_time 
          ? new Date(log.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '-'
        
        doc.text(employeeName.slice(0, 20), 14, yPos)
        doc.text(siteName.slice(0, 15), 60, yPos)
        doc.text(checkIn, 100, yPos)
        doc.text(checkOut, 130, yPos)
        doc.text(log.status.replace('_', ' '), 165, yPos)
        
        if (log.remarks) {
          yPos += 5
          doc.setFontSize(8)
          doc.setTextColor(100)
          doc.text(`Remarks: ${log.remarks.slice(0, 50)}`, 14, yPos)
          doc.setTextColor(0)
          doc.setFontSize(10)
        }
        
        yPos += 10
      }
      
      doc.save(`attendance-report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  const captureScreenshot = async () => {
    if (!reportRef.current) return
    
    setCapturing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement('a')
      link.download = `attendance-report-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Screenshot capture error:', err)
      alert('Failed to capture screenshot')
    } finally {
      setCapturing(false)
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported')
      return
    }
    
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSiteForm(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }))
        setGettingLocation(false)
      },
      (error) => {
        alert('Failed to get location: ' + error.message)
        setGettingLocation(false)
      }
    )
  }

  const handleSaveSite = async () => {
    if (!organisation?.id) return
    
    if (!siteForm.site_name || !siteForm.latitude || !siteForm.longitude) {
      alert('Please fill in required fields')
      return
    }
    
    setSavingSite(true)
    try {
      const siteData = {
        site_name: siteForm.site_name,
        latitude: parseFloat(siteForm.latitude),
        longitude: parseFloat(siteForm.longitude),
        radius_meters: parseInt(siteForm.radius_meters) || 100,
        address: siteForm.address || undefined,
        organization_id: organisation.id,
        is_active: true
      }
      
      if (editingSite) {
        const { error } = await updateSite(editingSite.id, siteData)
        if (error) throw error
      } else {
        const { error } = await createSite(siteData)
        if (error) throw error
      }
      
      setSiteForm(defaultSiteForm)
      setEditingSite(null)
      fetchSites()
    } catch (err) {
      console.error('Error saving site:', err)
      alert('Failed to save site')
    } finally {
      setSavingSite(false)
    }
  }

  const handleEditSite = (site: Site) => {
    setEditingSite(site)
    setSiteForm({
      site_name: site.site_name,
      latitude: site.latitude.toString(),
      longitude: site.longitude.toString(),
      radius_meters: site.radius_meters.toString(),
      address: site.address || ''
    })
  }

  const handleCancelEdit = () => {
    setEditingSite(null)
    setSiteForm(defaultSiteForm)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <Badge className="bg-green-100 text-green-800">Checked In</Badge>
      case 'checked_out':
        return <Badge className="bg-blue-100 text-blue-800">Checked Out</Badge>
      case 'absent':
        return <Badge className="bg-red-100 text-red-800">Absent</Badge>
      case 'on_leave':
        return <Badge className="bg-yellow-100 text-yellow-800">On Leave</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">HR Admin Dashboard</h1>
          <p className="text-zinc-500">Manage attendance and work sites</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="attendance" className="gap-2">
            <FileText className="w-4 h-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="sites" className="gap-2">
            <MapPin className="w-4 h-4" />
            Site Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Date Range Filter
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportToPDF}
                    disabled={exporting || loading}
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={captureScreenshot}
                    disabled={capturing || loading}
                  >
                    {capturing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 mr-2" />
                    )}
                    Capture Screenshot
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <Button onClick={fetchAttendanceLogs} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Apply Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          <div ref={reportRef} className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Attendance Report</h2>
                  <p className="text-sm text-zinc-500">
                    {organisation?.name} | {dateRange.startDate} to {dateRange.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Users className="w-4 h-4" />
                  <span>{attendanceLogs.length} records</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : attendanceLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                        No attendance records found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {log.recorded_at 
                            ? new Date(log.recorded_at).toLocaleDateString('en-IN')
                            : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(log.employee as any)?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {log.site?.site_name || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {log.check_in_time 
                            ? new Date(log.check_in_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {log.check_out_time 
                            ? new Date(log.check_out_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.status)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-zinc-600">
                          {log.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingSite ? (
                      <>
                        <Edit2 className="w-5 h-5" />
                        Edit Site: {editingSite.site_name}
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add New Site
                      </>
                    )}
                  </div>
                  {editingSite && (
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input
                    placeholder="Enter site name"
                    value={siteForm.site_name}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, site_name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude *</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.000000"
                        value={siteForm.latitude}
                        onChange={(e) => setSiteForm(prev => ({ ...prev, latitude: e.target.value }))}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={getCurrentLocation}
                        disabled={gettingLocation}
                        title="Get current location"
                      >
                        {gettingLocation ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Longitude *</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0.000000"
                      value={siteForm.longitude}
                      onChange={(e) => setSiteForm(prev => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Radius (meters) *</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={siteForm.radius_meters}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, radius_meters: e.target.value }))}
                  />
                  <p className="text-xs text-zinc-500">
                    Employees must be within this distance to check in
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Enter site address (optional)"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveSite}
                  disabled={savingSite}
                >
                  {savingSite ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  {editingSite ? 'Update Site' : 'Create Site'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Existing Sites ({sites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sites.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No sites configured yet</p>
                    <p className="text-sm">Add your first work site using the form</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sites.map(site => (
                      <div
                        key={site.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-zinc-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{site.site_name}</p>
                          <p className="text-sm text-zinc-500">
                            {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {site.radius_meters}m radius
                            </Badge>
                            {site.address && (
                              <span className="text-xs text-zinc-400">
                                {site.address.slice(0, 30)}...
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSite(site)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Site Map View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-zinc-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-zinc-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Interactive map placeholder</p>
                  <p className="text-sm">
                    Integrate Leaflet or Google Maps here for live site visualization
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
