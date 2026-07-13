import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useSiteVisits, useClients, useVisitPurposes, useProjectManagers, useAddSiteVisit, useUpdateSiteVisit, useAddPurpose } from '../hooks/useSiteVisits';
import { useProjects } from '../hooks/useProjects';
import { siteVisitScheduleSchema } from '../lib/validations/siteVisit';
import { 
  Plus, 
  MapPin, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  User,
  CalendarDays,
  Search,
  Trash2,
  Edit2,
  AlertCircle,
  Check,
  FileText,
  Pencil,
  Map as MapIcon,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  X,
  Eye,
  Download,
  Activity,
  History,
  Mic
} from 'lucide-react';
import { cn } from '../lib/utils';
import { QuickAddClientModal } from '../components/QuickAddClientModal';
import { Button, IconButton } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from '@/lib/logger';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  isToday
} from 'date-fns';

const CalendarView = ({ visits, onDateClick, onVisitClick }: any) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  
  const visitsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    visits.forEach((visit: any) => {
      const dateKey = format(parseISO(visit.visit_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(visit);
    });
    return map;
  }, [visits]);
  
  const getVisitsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return visitsByDay.get(dateKey) || [];
  };
  
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-zinc-200">
        <h2 className="text-2xl font-bold text-zinc-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-zinc-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg">
            Today
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-zinc-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-zinc-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "min-h-[100px] p-2 rounded-lg border cursor-pointer hover:bg-zinc-50 transition-colors",
                  !isCurrentMonth ? "bg-zinc-50 border-zinc-100 opacity-50" : "bg-white border-zinc-200",
                  isTodayDay ? "border-blue-500 ring-2 ring-blue-200" : ""
                )}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isTodayDay ? "text-blue-600" : isCurrentMonth ? "text-zinc-900" : "text-zinc-400"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="space-y-1">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium cursor-pointer",
                        visit.status === 'completed' ? "bg-green-100 text-green-800" :
                        visit.status === 'scheduled' ? "bg-blue-100 text-blue-800" :
                        visit.status === 'in_progress' ? "bg-purple-100 text-purple-800" :
                        visit.status === 'cancelled' ? "bg-red-100 text-red-800" :
                        "bg-zinc-100 text-zinc-800"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVisitClick(visit);
                      }}
                    >
                      {visit.clients?.client_name || 'Unknown'}
                      {visit.engineer || visit.visited_by ? ` - ${visit.engineer || visit.visited_by}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SiteVisitUpdatesView = ({ visits, onEdit, onDelete, onView }: any) => {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-zinc-50/80 border-b border-zinc-200">
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[120px]">Date</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Client</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Purpose</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[140px]">In / Out</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Technical Details (Measurements)</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Discussion & Notes</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Next Action</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits?.map((v: any) => (
              <tr key={v.id} className="border-b border-zinc-100 hover:bg-blue-50/30 transition-colors group">
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top whitespace-nowrap text-zinc-500 font-medium">
                  {v.visit_date ? format(parseISO(v.visit_date), 'dd MMM yyyy') : '--'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top font-semibold text-zinc-900">
                  {v.clients?.client_name || 'N/A'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {v.purpose_of_visit}
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 font-mono text-[12px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-emerald-600">↑ {v.visit_time || '--:--'}</span>
                    <span className="text-rose-600">↓ {v.out_time || '--:--'}</span>
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[200px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.measurements || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[300px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.discussion_points || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                  <div className="text-zinc-900 font-medium">{v.next_step || '--'}</div>
                  {v.follow_up_date && (
                    <div className="text-[10px] text-blue-600 mt-1.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-100">
                      Follow-up: {format(parseISO(v.follow_up_date), 'dd MMM')}
                    </div>
                  )}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                   <div className={cn(
                     "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                     v.status === 'completed' ? 'bg-green-100 text-green-700' :
                     v.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                     v.status === 'postponed' ? 'bg-amber-100 text-amber-700' :
                     'bg-zinc-100 text-zinc-600'
                   )}>
                    {v.status}
                   </div>
                </td>
                <td className="px-4 py-[8px] align-top">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onView?.(v)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => onEdit(v)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => window.print()} 
                      className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                      title="Print PDF"
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(v)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PaginationBar = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: any) => {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-zinc-500">
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}–{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', color: currentPage === 1 ? '#d4d4d4' : '#525252', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Prev</button>
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)} style={{ padding: '6px 12px', border: p === currentPage ? '1px solid #3b82f6' : '1px solid #d4d4d4', borderRadius: '6px', background: p === currentPage ? '#eff6ff' : '#fff', color: p === currentPage ? '#3b82f6' : '#525252', cursor: 'pointer', fontSize: '13px', fontWeight: p === currentPage ? 600 : 400 }}>{p}</button>
        ))}
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', color: currentPage === totalPages ? '#d4d4d4' : '#525252', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Next</button>
      </div>
    </div>
  );
};

export function SiteVisits() {
  const { user, organisation, organisations } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = useMemo(() => {
    const currentMember = organisations?.find((o: any) => o.organisation_id === organisation?.id || o.organisation?.id === organisation?.id);
    return currentMember?.role || '';
  }, [organisations, organisation]);

  useEffect(() => {
    const scheduleNew = searchParams.get('scheduleNew');
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');

    if (scheduleNew === 'true') {
      setFormData(prev => ({
        ...prev,
        client_id: clientId || '',
        project_id: projectId || '',
        visit_type: 'Maintenance',
      }));
      setIsFormOpen(true);
      
      // Immediately clear the query parameters to prevent navigation loops
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('scheduleNew');
        next.delete('projectId');
        next.delete('clientId');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'updates'>('table');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Array<string>>([]);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [newPurposeName, setNewPurposeName] = useState('');
  const [visitToView, setVisitToView] = useState<any | null>(null);
  const [visitActivityLogs, setVisitActivityLogs] = useState<any[]>([]);
  const [visitActivityLoading, setVisitActivityLoading] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    signed_off_by: '',
    signed_off_designation: ''
  });
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, string>>({});
  const [savedChecklist, setSavedChecklist] = useState<any[]>([]);

  // Continuous Improvement State
  const [observationOpen, setObservationOpen] = useState(false);
  const [observationCategory, setObservationCategory] = useState('');
  const [observationTitle, setObservationTitle] = useState('');
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome/Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setObservationTitle(speechToText);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Joint Measurement Sheets (JMS) & Testing & Commissioning (T&C) States
  const [jmsItems, setJmsItems] = useState<Array<{ item_name: string; unit: string; agreed_qty: number; rate: number }>>([]);
  const [jmsSubcontractorId, setJmsSubcontractorId] = useState<string>('');

  const [tcEquipmentId, setTcEquipmentId] = useState<string>('');
  const [tcTestType, setTcTestType] = useState<string>('');
  const [tcWitnessedBy, setTcWitnessedBy] = useState<string>('');
  const [tcReadings, setTcReadings] = useState<Array<{ parameter: string; required_value: string; actual_value: string; status: 'Pass' | 'Fail' | 'Pending' }>>([]);

  // Subcontractors & Project Equipment Queries
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, company_name')
        .eq('organisation_id', organisation.id)
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: projectEquipment = [] } = useQuery({
    queryKey: ['project-equipment', visitToView?.project_id],
    queryFn: async () => {
      if (!visitToView?.project_id) return [];
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', visitToView.project_id)
        .order('equipment_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!visitToView?.project_id && isCheckoutModalOpen,
  });

  const { data: visitJms = null, refetch: refetchVisitJms } = useQuery({
    queryKey: ['visit-jms', visitToView?.id],
    queryFn: async () => {
      if (!visitToView?.id) return null;
      const { data, error } = await supabase
        .from('joint_measurements')
        .select('*, subcontractor:subcontractors(company_name)')
        .eq('site_visit_id', visitToView.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!visitToView?.id && visitToView.status === 'completed',
  });

  const { data: visitTc = null, refetch: refetchVisitTc } = useQuery({
    queryKey: ['visit-tc', visitToView?.id],
    queryFn: async () => {
      if (!visitToView?.id) return null;
      const { data, error } = await supabase
        .from('tc_protocols')
        .select('*, equipment:project_equipment(equipment_name)')
        .eq('site_visit_id', visitToView.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!visitToView?.id && visitToView.status === 'completed',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? (e.touches[0] ? e.touches[0].clientX : 0) : e.clientX;
    const clientY = ('touches' in e) ? (e.touches[0] ? e.touches[0].clientY : 0) : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getChecklistQuestions = (visitType: string) => {
    if (visitType === 'Maintenance') {
      return [
        { id: 'm1', text: 'Pressure levels checked and adjusted?' },
        { id: 'm2', text: 'Lube / oil levels verified?' },
        { id: 'm3', text: 'Filters cleaned / replaced?' },
        { id: 'm4', text: 'Any signs of leakages detected?' }
      ];
    } else if (visitType === 'Inspection') {
      return [
        { id: 'i1', text: 'Structural integrity check completed?' },
        { id: 'i2', text: 'Electrical connections inspected?' },
        { id: 'i3', text: 'Safety signs and instructions visible?' }
      ];
    } else {
      return [
        { id: 'd1', text: 'Task successfully completed?' },
        { id: 'd2', text: 'Site clean and clear?' },
        { id: 'd3', text: 'Safety instructions followed?' }
      ];
    }
  };

  const saveChecklistResponses = async (visitId: string) => {
    if (!organisation?.id) return;
    const questions = getChecklistQuestions(visitToView?.visit_type || '');
    const responsesArray = questions.map((q: any) => ({
      question_id: q.id,
      question_text: q.text,
      answer: checklistAnswers[q.id] || 'N/A'
    }));

    const { error } = await supabase
      .from('visit_checklist_responses')
      .insert([{
        organisation_id: organisation.id,
        site_visit_id: visitId,
        responses: responsesArray
      }]);

    if (error) {
      console.warn('Error saving checklist responses:', error);
    }
  };

  useEffect(() => {
    if (!visitToView?.id) {
      setSavedChecklist([]);
      return;
    }
    const fetchChecklist = async () => {
      const { data, error } = await supabase
        .from('visit_checklist_responses')
        .select('*')
        .eq('site_visit_id', visitToView.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setSavedChecklist(data[0].responses || []);
      }
    };
    fetchChecklist();
  }, [visitToView?.id]);

  const [isGlobalActivityOpen, setIsGlobalActivityOpen] = useState(false);
  const [globalActivityLogs, setGlobalActivityLogs] = useState<any[]>([]);
  const [globalActivityLoading, setGlobalActivityLoading] = useState(false);
  const [formSection, setFormSection] = useState<'schedule' | 'report' | 'expenses'>('schedule');

  const fetchVisitActivity = async (visitId: string) => {
    if (!organisation?.id || !visitId) return;
    setVisitActivityLoading(true);
    try {
      const { data } = await supabase
        .from('site_visit_activity_log')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('site_visit_id', visitId)
        .order('created_at', { ascending: false })
        .limit(50);
      setVisitActivityLogs(data || []);
    } catch { setVisitActivityLogs([]); }
    setVisitActivityLoading(false);
  };

  const fetchGlobalActivity = async () => {
    if (!organisation?.id) return;
    setGlobalActivityLoading(true);
    try {
      const { data } = await supabase
        .from('site_visit_activity_log')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setGlobalActivityLogs(data || []);
    } catch { setGlobalActivityLogs([]); }
    setGlobalActivityLoading(false);
  };

  useEffect(() => {
    if (visitToView?.id) {
      fetchVisitActivity(visitToView.id);
    } else {
      setVisitActivityLogs([]);
    }
  }, [visitToView?.id]);

  const handleCheckIn = async (visit: any) => {
    const today = new Date().toISOString().split('T')[0];
    if (visit.visit_date > today) {
      toast.error(`Cannot check in before the visit date. This visit is scheduled for ${visit.visit_date}.`);
      return;
    }

    const timeNow = new Date().toISOString();
    
    const saveCheckIn = async (lat: number | null, lng: number | null, status: string) => {
      try {
        const { error } = await supabase
          .from('site_visits')
          .update({
            check_in_lat: lat,
            check_in_lng: lng,
            check_in_time: timeNow,
            status: status
          })
          .eq('id', visit.id);

        if (error) throw error;
        
        const updatedVisit = { ...visit, check_in_lat: lat, check_in_lng: lng, check_in_time: timeNow, status };
        setVisitToView(updatedVisit);
        queryClient.invalidateQueries({ queryKey: ['site-visits'] });
        toast.success('Successfully checked in!');
      } catch (err: any) {
        toast.error('Error during check-in: ' + err.message);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCheckIn(position.coords.latitude, position.coords.longitude, 'in_progress');
        },
        (error) => {
          console.warn('Geolocation error:', error);
          saveCheckIn(null, null, 'Location Denied');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveCheckIn(null, null, 'Location Denied');
    }
  };

  const handleCheckOut = async (visit: any) => {
    const timeNow = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const checkOutNote = visit.visit_date < today
      ? `Late check-out: actual visit ended on ${visit.visit_date}, recorded at ${timeNow}`
      : null;

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null;

    const saveCheckOut = async (lat: number | null, lng: number | null) => {
      try {
        const { error } = await supabase
          .from('site_visits')
          .update({
            check_out_lat: lat,
            check_out_lng: lng,
            check_out_time: timeNow,
            signed_off_by: checkoutData.signed_off_by,
            signed_off_designation: checkoutData.signed_off_designation,
            signature_image_url: signatureDataUrl,
            signed_off_at: timeNow,
            status: 'completed',
            check_out_note: checkOutNote,
          })
          .eq('id', visit.id);

        if (error) throw error;

        await saveChecklistResponses(visit.id);

        // Save Observation if category and title are present
        if (observationCategory && observationTitle) {
          const { error: obsError } = await supabase
            .from('project_insights')
            .insert([{
              organisation_id: organisation?.id,
              project_id: visit.project_id,
              source_type: 'site_visit',
              source_id: visit.id,
              site_visit_id: visit.id,
              category: observationCategory,
              title: observationTitle,
              status: 'Open',
              visibility: 'Everyone',
              created_by: user?.id || null
            }]);
          if (obsError) throw obsError;
        }

        // Save JMS Items if present
        if (jmsItems.length > 0) {
          const { error: jmsError } = await supabase
            .from('joint_measurements')
            .insert([{
              organisation_id: organisation?.id,
              project_id: visit.project_id,
              site_visit_id: visit.id,
              measured_date: new Date().toISOString().split('T')[0],
              measured_items: jmsItems,
              subcontractor_id: jmsSubcontractorId || null
            }]);
          if (jmsError) throw jmsError;
        }

        // Save T&C Protocols if present
        if (tcEquipmentId && tcTestType) {
          const { error: tcError } = await supabase
            .from('tc_protocols')
            .insert([{
              organisation_id: organisation?.id,
              equipment_id: tcEquipmentId,
              site_visit_id: visit.id,
              test_type: tcTestType,
              readings: tcReadings,
              witnessed_by_client: tcWitnessedBy || null
            }]);
          if (tcError) throw tcError;
        }

        const updatedVisit = {
          ...visit,
          check_out_lat: lat,
          check_out_lng: lng,
          check_out_time: timeNow,
          signed_off_by: checkoutData.signed_off_by,
          signed_off_designation: checkoutData.signed_off_designation,
          signature_image_url: signatureDataUrl,
          signed_off_at: timeNow,
          status: 'completed',
          check_out_note: checkOutNote,
        };
        setVisitToView(updatedVisit);
        setIsCheckoutModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['site-visits'] });
        
        // Refetch JMS & T&C detail queries
        refetchVisitJms();
        refetchVisitTc();

        toast.success('Successfully checked out & completed visit!');
      } catch (err: any) {
        toast.error('Error during check-out: ' + err.message);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCheckOut(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          saveCheckOut(null, null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveCheckOut(null, null);
    }
  };

  const toggleVisitSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedVisits(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  // Multi-step form state - UPDATED TO MATCH DB COLUMNS
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    client_id: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    purpose_of_visit: '',
    visited_by: '',
    engineer: '',
    visit_time: '',
    out_time: '',
    site_address: '',
    location_url: '',
    discussion_points: '',
    measurements: '',
    status: 'scheduled',
    next_step: '',
    follow_up_date: '',
    postponed_reason: '',
    is_client_meeting: false,
    project_id: '',
    po_wo_contract: '',
    project_manager_id: '',
    site_contact_person: '',
    site_contact_phone: '',
    site_contact_designation: '',
    visit_type: 'Survey',
    priority: 'Standard',
    ppe_requirements: '',
    is_chargeable: false,
    access_restrictions: '',
    attendees: [],
    equipment_used: '',
    travel_time_minutes: null,
    total_man_hours: null,
    weather_conditions: '',
    safety_hazards: '',
    issues_found: [],
    recommendations: '',
    travel_expense: null,
    accommodation_expense: null,
    misc_expense: null,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [engineerFilter, setEngineerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatesPage, setUpdatesPage] = useState(1);
  const itemsPerPage = 15;

  // Memoize status filter button onClick
  const setStatusFilterCallback = useCallback((filter: string) => {
    setStatusFilter(filter);
  }, []);

  const defaultColumns = { date: true, client: true, visitedBy: true, status: true, nextStep: true, actions: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('siteVisitColumns');
      return saved ? JSON.parse(saved) : defaultColumns;
    } catch {
      return defaultColumns;
    }
  });

  // Debounced localStorage write
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('siteVisitColumns', JSON.stringify(visibleColumns));
    }, 500);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [visibleColumns]);

  const queryClient = useQueryClient();

  const { data: visits, isLoading: isLoadingVisits } = useSiteVisits();
  const { data: clients } = useClients();
  const { data: purposes } = useVisitPurposes();
  const { data: projectManagers } = useProjectManagers();
  const { data: projects } = useProjects();

  const addPurposeMutation = useAddPurpose();
  const addVisitMutation = useAddSiteVisit();
  const updateVisitMutation = useUpdateSiteVisit();

  const saveVisit = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        return updateVisitMutation.mutateAsync(data);
      }
      return addVisitMutation.mutateAsync(data);
    },
    onSuccess: (returnedData: any, variables: any) => {
      setIsFormOpen(false);
      setIsUpdateModalOpen(false);
      setSelectedVisit(null);
      resetForm();
      toast.success('Site visit saved successfully');

      const visitId = returnedData?.id || variables?.id;
      if (visitId) {
        const isDraft = variables?.status === 'pending' && !variables?.id;
        if (isDraft) {
          logSiteVisitActivity(visitId, 'site_visit_draft_saved', 'Site visit saved as draft', `Draft saved for ${variables?.client_id || 'unknown'} by ${user?.email}`);
        } else if (variables?.id) {
          logSiteVisitActivity(visitId, 'site_visit_updated', 'Site visit updated', `Visit details updated by ${user?.email}`);
        } else {
          logSiteVisitActivity(visitId, 'site_visit_created', 'Site visit created', `New visit created for client ${variables?.client_id || 'unknown'} by ${user?.email}`);
        }
      }
    },
    onError: (error: any) => {
      toast.error(`Error saving visit: ${error.message}`);
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_visits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (id: string) => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVisitToDelete(null);
      toast.success('Visit deleted successfully');
      logSiteVisitActivity(id, 'site_visit_deleted', 'Site visit deleted', `Visit ${id} deleted by ${user?.email}`);
    },
    onError: (error: any) => {
      toast.error(`Error deleting visit: ${error.message}`);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      setBatchDeleteProgress({ current: 0, total: ids.length });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase
          .from('site_visits')
          .delete()
          .eq('id', ids[i]);
        
        if (error) throw error;
        setBatchDeleteProgress({ current: i + 1, total: ids.length });
      }
      return ids;
    },
    onSuccess: (ids: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setSelectedVisits([]);
      setBatchDeleteProgress(null);
      toast.success('Selected visits deleted successfully');
      ids.forEach((id) => {
        logSiteVisitActivity(id, 'site_visit_deleted', 'Site visit deleted', `Batch delete by ${user?.email}`);
      });
    },
    onError: (error: any) => {
      setBatchDeleteProgress(null);
      toast.error(`Error deleting visits: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      visit_date: format(new Date(), 'yyyy-MM-dd'),
      purpose_of_visit: '',
      visited_by: '',
      engineer: '',
      visit_time: '',
      out_time: '',
      site_address: '',
      location_url: '',
      discussion_points: '',
      measurements: '',
      status: 'scheduled',
      next_step: '',
      follow_up_date: '',
      postponed_reason: '',
      is_client_meeting: false,
      project_id: '',
      po_wo_contract: '',
      project_manager_id: '',
      site_contact_person: '',
      site_contact_phone: '',
      site_contact_designation: '',
      visit_type: 'Survey',
      priority: 'Standard',
      ppe_requirements: '',
      is_chargeable: false,
      access_restrictions: '',
      attendees: [],
      equipment_used: '',
      travel_time_minutes: null,
      total_man_hours: null,
      weather_conditions: '',
      safety_hazards: '',
      issues_found: [],
      recommendations: '',
      travel_expense: null,
      accommodation_expense: null,
      misc_expense: null,
    });
    setCurrentStep(1);
    setSelectedVisit(null);
    setFormSection('schedule');
  };

  const logSiteVisitActivity = async (visitId: string, eventType: string, title: string, description: string = '') => {
    try {
      const actorName = user?.user_metadata?.full_name || user?.email || 'System';
      await supabase.from('site_visit_activity_log').insert({
        organisation_id: organisation?.id,
        site_visit_id: visitId,
        event_type: eventType,
        title,
        description,
        actor_id: user?.id,
        actor_name: actorName,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitVisit(false);
  };

  const handleSaveDraft = () => {
    submitVisit(true);
  };

  const submitVisit = (isDraft: boolean) => {
    if (!organisation?.id) {
      toast.error('Organisation ID missing. Please reload.');
      return;
    }

    // Filter out empty string values for date fields to avoid PostgreSQL errors
    const visitData = {
      ...formData,
      status: isDraft ? 'pending' : formData.status,
      organisation_id: organisation.id,
      created_by: user?.id,
      follow_up_date: formData.follow_up_date || null,
    };

    if (selectedVisit) {
      saveVisit.mutate({ ...visitData, id: selectedVisit.id });
    } else {
      saveVisit.mutate(visitData);
    }
  };

  const handleEditVisit = (visit: any) => {
    setSelectedVisit(visit);
    setFormData({
      client_id: visit.client_id || '',
      visit_date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
      purpose_of_visit: visit.purpose_of_visit || '',
      visited_by: visit.visited_by || '',
      engineer: visit.engineer || '',
      visit_time: visit.visit_time || '',
      out_time: visit.out_time || '',
      site_address: visit.site_address || '',
      location_url: visit.location_url || '',
      discussion_points: visit.discussion_points || '',
      measurements: visit.measurements || '',
      status: visit.status || 'pending',
      next_step: visit.next_step || '',
      follow_up_date: visit.follow_up_date || '',
      postponed_reason: visit.postponed_reason || '',
      is_client_meeting: visit.is_client_meeting || false,
      project_id: visit.project_id || '',
      po_wo_contract: visit.po_wo_contract || '',
      project_manager_id: visit.project_manager_id || '',
      site_contact_person: visit.site_contact_person || '',
      site_contact_phone: visit.site_contact_phone || '',
      site_contact_designation: visit.site_contact_designation || '',
      visit_type: visit.visit_type || 'Survey',
      priority: visit.priority || 'Standard',
      ppe_requirements: visit.ppe_requirements || '',
      is_chargeable: visit.is_chargeable || false,
      access_restrictions: visit.access_restrictions || '',
      attendees: visit.attendees || [],
      equipment_used: visit.equipment_used || '',
      travel_time_minutes: visit.travel_time_minutes || null,
      total_man_hours: visit.total_man_hours || null,
      weather_conditions: visit.weather_conditions || '',
      safety_hazards: visit.safety_hazards || '',
      issues_found: visit.issues_found || [],
      recommendations: visit.recommendations || '',
      travel_expense: visit.travel_expense || null,
      accommodation_expense: visit.accommodation_expense || null,
      misc_expense: visit.misc_expense || null,
    });
    // Open the simple form only if the detailed update modal is not active
    if (!isUpdateModalOpen) {
      setIsFormOpen(true);
    }
  };

  const formatUTC = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeIcsText = (str: string) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  };

  const handleAddToGoogleCalendar = (visit: any) => {
    if (!visit || !visit.visit_date) return;

    const dateStr = visit.visit_date; // YYYY-MM-DD
    const timeStr = visit.visit_time; // HH:mm or HH:mm:ss

    let dates = '';
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':');
      const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
      const start = new Date(year, month - 1, day);
      start.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      dates = `${formatUTC(start)}/${formatUTC(end)}`;
    } else {
      const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
      const startDateObj = new Date(year, month - 1, day);
      const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
      
      const formatYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${r}`;
      };
      
      dates = `${formatYMD(startDateObj)}/${formatYMD(endDateObj)}`;
    }

    const clientName = visit.clients?.client_name || 'N/A';
    const purpose = visit.purpose_of_visit || 'Site Visit';
    const title = `Site Visit: ${purpose} - ${clientName}`;

    const engineerName = visit.engineer || visit.visited_by || 'N/A';
    const contactPerson = visit.site_contact_person
      ? `${visit.site_contact_person} (${visit.site_contact_designation || 'Contact'}) - ${visit.site_contact_phone || ''}`
      : 'N/A';
    const notes = visit.discussion_points || '';

    const details = [
      `Client: ${clientName}`,
      `Purpose: ${purpose}`,
      `Engineer/Visited By: ${engineerName}`,
      `Site Contact: ${contactPerson}`,
      notes ? `Discussion/Notes:\n${notes}` : ''
    ].filter(Boolean).join('\n\n');

    const location = visit.site_address || '';

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    window.open(gcalUrl, '_blank');
  };

  const handleDownloadIcsFile = (visit: any) => {
    if (!visit || !visit.visit_date) return;

    const dateStr = visit.visit_date; // YYYY-MM-DD
    const timeStr = visit.visit_time; // HH:mm or HH:mm:ss

    let dtstart = '';
    let dtend = '';

    const clientName = visit.clients?.client_name || 'N/A';
    const purpose = visit.purpose_of_visit || 'Site Visit';
    const title = `Site Visit: ${purpose} - ${clientName}`;

    const engineerName = visit.engineer || visit.visited_by || 'N/A';
    const contactPerson = visit.site_contact_person
      ? `${visit.site_contact_person} (${visit.site_contact_designation || 'Contact'}) - ${visit.site_contact_phone || ''}`
      : 'N/A';
    const notes = visit.discussion_points || '';

    const details = [
      `Client: ${clientName}`,
      `Purpose: ${purpose}`,
      `Engineer/Visited By: ${engineerName}`,
      `Site Contact: ${contactPerson}`,
      notes ? `Discussion/Notes:\n${notes}` : ''
    ].filter(Boolean).join('\n\n');

    const location = visit.site_address || '';

    if (timeStr) {
      const [hours, minutes] = timeStr.split(':');
      const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
      const start = new Date(year, month - 1, day);
      start.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      dtstart = `DTSTART:${formatUTC(start)}`;
      dtend = `DTEND:${formatUTC(end)}`;
    } else {
      const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
      const startDateObj = new Date(year, month - 1, day);
      const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
      
      const formatYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${r}`;
      };
      
      dtstart = `DTSTART;VALUE=DATE:${formatYMD(startDateObj)}`;
      dtend = `DTEND;VALUE=DATE:${formatYMD(endDateObj)}`;
    }

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MEP Project//Site Visit Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:site-visit-${visit.id || Date.now()}@mep-project`,
      `DTSTAMP:${formatUTC(new Date())}`,
      dtstart,
      dtend,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(details)}`,
      `LOCATION:${escapeIcsText(location)}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    const icsContent = icsLines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `site-visit-${visit.visit_date || 'event'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadVisitPDF = async (visit: any) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header Brand
      doc.setFillColor(37, 99, 235); // Blue
      doc.rect(0, 0, 210, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('MEP PROJECT MANAGEMENT SYSTEM', 20, 10);

      // Document title
      doc.setFontSize(22);
      doc.setTextColor(23, 23, 23); // #171717
      doc.text('SITE VISIT REPORT', 20, 32);

      // Visit ID
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(115, 115, 115); // #737373
      doc.text(`Visit ID: SV-${visit.id.slice(0, 6).toUpperCase()}`, 20, 39);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 145, 39);

      // Divider
      doc.setDrawColor(229, 229, 229);
      doc.setLineWidth(0.5);
      doc.line(20, 43, 190, 43);

      let y = 52;

      // Section: Scheduling details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235); // Blue
      doc.text('1. Scheduling & Client Details', 20, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(82, 82, 82);

      const leftColX = 20;
      const rightColX = 110;

      const printField = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(82, 82, 82);
        doc.text(`${label}:`, leftColX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(23, 23, 23);
        doc.text(String(value || 'N/A'), leftColX + 35, y);
      };

      const printFieldRight = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(82, 82, 82);
        doc.text(`${label}:`, rightColX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(23, 23, 23);
        doc.text(String(value || 'N/A'), rightColX + 35, y);
      };

      // Client and Date
      printField('Client', visit.clients?.client_name);
      printFieldRight('Visit Date', visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'N/A');
      y += 7;

      // Purpose and Time
      printField('Purpose', visit.purpose_of_visit);
      printFieldRight('Visit Time', visit.visit_time || 'N/A');
      y += 7;

      // Engineer and Status
      printField('Engineer', visit.engineer || 'N/A');
      printFieldRight('Status', visit.status ? visit.status.toUpperCase() : 'N/A');
      y += 7;

      // PO/WO/Contract and Project Manager
      const manager = projectManagers?.find((pm: any) => pm.id === visit.project_manager_id);
      const pmName = manager ? (manager.full_name || manager.email) : 'N/A';
      printField('PO/WO/Contract', visit.po_wo_contract);
      printFieldRight('Project Manager', pmName);
      y += 7;

      // Visit Type and Priority
      printField('Visit Type', visit.visit_type);
      printFieldRight('Priority', visit.priority);
      y += 7;

      // PPE and Access Restrictions
      printField('PPE Req.', visit.ppe_requirements);
      printFieldRight('Access Restr.', visit.access_restrictions);
      y += 7;

      // Site Contact details
      printField('Contact Person', visit.site_contact_person);
      printFieldRight('Contact Phone', visit.site_contact_phone);
      y += 7;

      printField('Designation', visit.site_contact_designation);
      printFieldRight('Chargeable', visit.is_chargeable ? 'Yes' : 'No');
      y += 7;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(82, 82, 82);
      doc.text('Site Address:', leftColX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(23, 23, 23);
      const addressLines = doc.splitTextToSize(visit.site_address || 'N/A', 130);
      doc.text(addressLines, leftColX + 35, y);
      y += (addressLines.length * 5) + 3;

      // Section 2: Operational Report
      doc.setDrawColor(229, 229, 229);
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text('2. Operational Report Details', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(82, 82, 82);

      printField('Out Time', visit.out_time);
      printFieldRight('Weather', visit.weather_conditions);
      y += 7;

      printField('Travel Time', visit.travel_time_minutes ? `${visit.travel_time_minutes} mins` : 'N/A');
      printFieldRight('Total Man Hours', visit.total_man_hours ? `${visit.total_man_hours} hrs` : 'N/A');
      y += 9;

      // Text areas with page break check
      const printTextArea = (label: string, text: string) => {
        const lines = doc.splitTextToSize(text || 'None recorded.', 160);
        const estimatedHeight = 5 + (lines.length * 5) + 5;
        if (y + estimatedHeight > 275) {
          doc.addPage();
          y = 25;
        }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(82, 82, 82);
        doc.text(`${label}:`, leftColX, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(23, 23, 23);
        doc.text(lines, leftColX, y);
        y += (lines.length * 5) + 6;
      };

      printTextArea('Equipment/Tools Used', visit.equipment_used);
      printTextArea('Safety Hazards Identified', visit.safety_hazards);
      printTextArea('Discussion & Minutes of Meeting', visit.discussion_points);
      printTextArea('Measurements & Dimensions', visit.measurements);
      printTextArea('Actionable Recommendations', visit.recommendations);

      // Section 3: Expenses
      const travelExp = visit.travel_expense || 0;
      const stayExp = visit.accommodation_expense || 0;
      const miscExp = visit.misc_expense || 0;
      const totalExp = travelExp + stayExp + miscExp;

      const estimatedExpHeight = 8 + 8 + 7 + 7 + 10;
      if (y + estimatedExpHeight > 275) {
        doc.addPage();
        y = 25;
      }

      doc.setDrawColor(229, 229, 229);
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text('3. Visit Expenses', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(82, 82, 82);

      printField('Travel Expense', `INR ${travelExp.toFixed(2)}`);
      printFieldRight('Stay/Accommodation', `INR ${stayExp.toFixed(2)}`);
      y += 7;
      printField('Misc. Expense', `INR ${miscExp.toFixed(2)}`);
      doc.setFont('helvetica', 'bold');
      printFieldRight('Total Expenses', `INR ${totalExp.toFixed(2)}`);
      y += 12;

      // Footer
      if (y > 275) {
        doc.addPage();
        y = 25;
      }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('This is an automated system generated report.', 20, y);

      doc.save(`Site_Visit_Report_SV-${visit.id.slice(0, 6).toUpperCase()}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleDeleteVisit = (visit: any) => {
    setVisitToDelete(visit);
  };

  const confirmDelete = () => {
    if (visitToDelete) {
      deleteVisitMutation.mutate(visitToDelete.id);
    }
  };

  const handleBatchDelete = () => {
    if (selectedVisits.length > 0) {
      batchDeleteMutation.mutate(selectedVisits);
    }
  };

  // Filter visits based on search and filters
  const filteredVisits = useMemo(() => {
    if (!visits) return [];

    return visits.filter((v: any) => {
      // Status filter
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;

      // Search filter
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase();
        const clientMatch = v.clients?.client_name?.toLowerCase().includes(query);
        const engineerMatch = v.engineer?.toLowerCase().includes(query) || v.visited_by?.toLowerCase().includes(query);
        const locationMatch = v.site_address?.toLowerCase().includes(query);

        if (!clientMatch && !engineerMatch && !locationMatch) return false;
      }

      // Project filter (client)
      if (projectFilter !== 'all' && v.client_id !== projectFilter) return false;

      // Engineer filter
      if (engineerFilter !== 'all') {
        const engineer = v.engineer || v.visited_by;
        if (engineer !== engineerFilter) return false;
      }

      return true;
    });
  }, [visits, statusFilter, deferredSearchQuery, projectFilter, engineerFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!visits) return { total: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    
    return {
      total: visits.length,
      scheduled: visits.filter((v: any) => v.status === 'scheduled').length,
      in_progress: visits.filter((v: any) => v.status === 'in_progress').length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      cancelled: visits.filter((v: any) => v.status === 'cancelled').length,
    };
  }, [visits]);

  // Pagination
  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVisits, currentPage, itemsPerPage]);

  const updatesTotalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedUpdates = useMemo(() => {
    const startIndex = (updatesPage - 1) * itemsPerPage;
    return filteredVisits.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVisits, updatesPage, itemsPerPage]);

  // Get unique engineers for filter
  const engineers = useMemo(() => {
    if (!visits) return [];
    const engineerSet = new Set<string>();
    visits.forEach((v: any) => {
      const engineer = v.engineer || v.visited_by;
      if (engineer) engineerSet.add(engineer);
    });
    return Array.from(engineerSet);
  }, [visits]);

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!formData.client_id || !projects) return [];
    return projects.filter((p: any) => p.client_id === formData.client_id);
  }, [formData.client_id, projects]);

  const handleClientChange = (value: string) => {
    setFormData({ ...formData, client_id: value, project_id: '' });
  };

  const CustomSelect = ({ value, options, onChange, placeholder, style }: { value: string; options: { value: string; label: string }[]; onChange: (val: string) => void; placeholder?: string; style?: React.CSSProperties }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label;

    return (
      <div ref={ref} style={{ position: 'relative', ...style }}>
        <div
          onClick={() => setOpen(!open)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            fontSize: '14px',
            color: value ? '#171717' : '#999',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          {selectedLabel || placeholder || 'Select...'}
          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#999' }}>▾</span>
        </div>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              marginTop: '2px',
            }}
          >
            {options.length === 0 && (
              <div style={{ padding: '8px 12px', color: '#999', fontSize: '13px' }}>No options</div>
            )}
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => { onChange(option.value); setOpen(false); }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = option.value === value ? '#f0f7ff' : '#fff'}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: option.value === value ? '#f0f7ff' : '#fff',
                  color: '#171717',
                  fontSize: '14px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Select all toggle
  const toggleSelectAll = () => {
    if (selectedVisits.length === paginatedVisits.length) {
      setSelectedVisits([]);
    } else {
      setSelectedVisits(paginatedVisits.map((v: any) => v.id));
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border border-red-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <RefreshCcw className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPurposeIcon = (purpose: string) => {
    if (purpose?.toLowerCase().includes('measurement')) return <FileText className="w-5 h-5" />;
    if (purpose?.toLowerCase().includes('follow')) return <CalendarDays className="w-5 h-5" />;
    if (purpose?.toLowerCase().includes('inspection')) return <FileText className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (isLoadingVisits) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Site Visits</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {stats.total}
          </span>
          
          <div className="h-4 w-px bg-zinc-200 mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Scheduled</span>
          <span className="text-xs font-medium text-blue-600">{stats.scheduled}</span>
          
          <div className="h-4 w-px bg-zinc-200 mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">In Progress</span>
          <span className="text-xs font-medium text-purple-600">{stats.in_progress}</span>

          <div className="h-4 w-px bg-zinc-200 mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">Completed</span>
          <span className="text-xs font-medium text-green-600">{stats.completed}</span>

          <div className="h-4 w-px bg-zinc-200 mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Cancelled</span>
          <span className="text-xs font-medium text-red-600">{stats.cancelled}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsGlobalActivityOpen(true); fetchGlobalActivity(); }}
            className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98] transition-all"
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <History className="w-4 h-4 mr-1.5" />
            Activity Log
          </button>
          <button
            onClick={() => setIsUpdateModalOpen(true)}
            className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98] transition-all"
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <RefreshCcw className="w-4 h-4 mr-1.5 text-blue-500" />
            Site Visit Update
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98] transition-all"
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Site Visit
          </button>
        </div>
      </div>

      {/* Sub-tab row */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50" style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('all');
              setViewMode('table');
            }}
            className={cn(
              "w-[150px] h-[26px] px-4 text-sm font-medium transition-colors rounded-md flex items-center justify-center gap-1.5",
              activeTab === 'all' && viewMode === 'table'
                ? "bg-blue-600/10 text-blue-600"
                : "text-zinc-600 hover:bg-zinc-100"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            All Visits
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              "w-[150px] h-[26px] px-4 text-sm font-medium transition-colors rounded-md flex items-center justify-center gap-1.5",
              viewMode === 'calendar' ? "bg-blue-600/10 text-blue-600" : "text-zinc-600 hover:bg-zinc-100"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('updates')}
            className={cn(
              "w-[150px] h-[26px] px-4 text-sm font-medium transition-colors rounded-md flex items-center justify-center gap-1.5",
              viewMode === 'updates' ? "bg-blue-600/10 text-blue-600" : "text-zinc-600 hover:bg-zinc-100"
            )}
          >
            <FileText className="w-4 h-4" />
            Updates
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[150px] h-[26px] px-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white">
        
        {/* Table View */}
        {viewMode === 'table' && (
          <div className="flex flex-col h-full bg-white">
            
            {/* Bulk Action Header */}
            {selectedVisits.length > 0 && (
              <div className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl">
                <div>
                  <span className="text-sm font-semibold">{selectedVisits.length} selected</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-3">Bulk Actions</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 active:scale-[0.98] transition-all hover:bg-zinc-100"
                  >
                    Print
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 active:scale-[0.98] transition-all hover:bg-red-700"
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-white">
                    <th className="sticky top-0 z-10 h-[36px] w-[50px] px-4 text-center align-middle bg-white border-b border-zinc-200">
                      <Checkbox
                        checked={selectedVisits.length === paginatedVisits.length && paginatedVisits.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Visit ID & Purpose
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Client
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Location
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Date & Time
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Status
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                      <span className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                        Assigned To
                      </span>
                    </th>
                    <th className="sticky top-0 z-10 h-[36px] w-[70px] px-6 pl-1 text-center align-middle bg-white border-b border-zinc-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVisits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-sm text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <CalendarDays className="w-12 h-12 text-zinc-300" />
                          <p className="text-zinc-600 font-medium">No site visits found</p>
                          <p className="text-sm text-zinc-500">Try adjusting your filters or create a new visit</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedVisits.map((visit: any, index: number) => {
                      const isSelected = selectedVisits.includes(visit.id);
                      return (
                        <tr 
                          key={visit.id} 
                          className={cn(
                            "border-t border-zinc-200/70 transition-all",
                            index % 2 === 0 ? "bg-white" : "bg-zinc-50/30",
                            isSelected ? "bg-indigo-50/50 border-l-blue-600" : "hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm"
                          )}
                        >
                          <td className="px-4 py-[26px] text-center align-middle">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => toggleVisitSelection(visit.id)}
                            />
                          </td>
                          
                          {/* Visit ID & Purpose */}
                          <td className="px-6 py-[26px] align-middle">
                            <div>
                              <div className="font-semibold text-zinc-900 text-sm">SV-{visit.id.slice(0, 6)}</div>
                              <div className="text-xs text-zinc-600 max-w-[180px] truncate" title={visit.purpose_of_visit || 'Site Measurement'}>
                                {visit.purpose_of_visit || 'Site Measurement'}
                              </div>
                            </div>
                          </td>

                          {/* Client */}
                          <td className="px-6 py-[26px] align-middle">
                            <div>
                              <div className="font-medium text-zinc-900 text-sm">{visit.clients?.client_name || 'N/A'}</div>
                              <div className="text-xs text-zinc-500">{visit.clients?.phone || ''}</div>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="px-6 py-[26px] align-middle">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-zinc-800 max-w-[220px] truncate" title={visit.site_address || 'No address'}>
                                {visit.site_address || 'No address'}
                              </div>
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td className="px-6 py-[26px] align-middle">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-sm text-zinc-900">
                                <CalendarIcon className="w-4 h-4 text-zinc-400" />
                                {format(parseISO(visit.visit_date), 'd MMM yyyy')}
                              </div>
                              {visit.visit_time && (
                                <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
                                  <Clock className="w-3 h-3 text-zinc-400" />
                                  {visit.visit_time}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-[26px] align-middle">
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase",
                              getStatusBadgeColor(visit.status)
                            )}>
                              {getStatusIcon(visit.status)}
                              <span>{visit.status.replace('_', ' ')}</span>
                            </div>
                          </td>

                          {/* Assigned To */}
                          <td className="px-6 py-[26px] align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {(visit.engineer || visit.visited_by || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-zinc-900">{visit.engineer || visit.visited_by || 'Unassigned'}</div>
                                <div className="text-xs text-zinc-500">Engineer</div>
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-[26px] text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setVisitToView(visit)}
                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors active:scale-[0.98]"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleEditVisit(visit)}
                                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors active:scale-[0.98]"
                              >
                                <Edit2 className="w-4 h-4 text-zinc-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteVisit(visit)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.98]"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
                <span className="text-sm font-medium text-zinc-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length} entries
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className={cn(
                      currentPage === 1
                        ? "h-[32px] min-w-[80px] inline-flex items-center justify-center text-sm font-medium rounded-md px-3 border border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                        : "h-[32px] min-w-[80px] inline-flex items-center justify-center text-sm font-medium transition-all rounded-md px-3 border border-zinc-200 shadow-sm text-zinc-700 hover:bg-zinc-200 bg-white"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1.5">
                    {[...Array(Math.min(totalPages, 7))].map((_, idx) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = idx + 1;
                      } else if (currentPage <= 3) {
                        pageNum = idx + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 6 + idx;
                      } else {
                        pageNum = currentPage - 3 + idx;
                      }

                      if (pageNum === currentPage - 3 && currentPage > 4) {
                        return <span key="ellipsis1" className="px-2 text-zinc-400">...</span>;
                      }
                      if (pageNum === currentPage + 3 && currentPage < totalPages - 3) {
                        return <span key="ellipsis2" className="px-2 text-zinc-400">...</span>;
                      }

                      const isPageActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-[32px] min-w-[32px] px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center justify-center",
                            isPageActive
                              ? "bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm font-semibold"
                              : "text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={cn(
                      currentPage === totalPages
                        ? "h-[32px] min-w-[80px] inline-flex items-center justify-center text-sm font-medium rounded-md px-3 border border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                        : "h-[32px] min-w-[80px] inline-flex items-center justify-center text-sm font-medium transition-all rounded-md px-3 border border-zinc-200 shadow-sm text-zinc-700 hover:bg-zinc-200 bg-white"
                    )}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!visitToDelete} onOpenChange={() => setVisitToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Site Visit</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this visit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setVisitToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteVisitMutation.isPending}
            >
              {deleteVisitMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog - Revamped with professional aesthetic */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); resetForm(); }}
                style={{ padding: '4px', border: 'none', background: 'transparent', color: '#737373', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Core scheduling fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT *</label>
                    <CustomSelect
                      value={formData.client_id}
                      onChange={handleClientChange}
                      placeholder="Select client"
                      options={clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || []}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT DATE *</label>
                    <input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      required
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>
                </div>

                {/* Project select field */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT</label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      {(!formData.client_id || filteredProjects.length === 0) ? (
                        <option value="" disabled>No active projects for this client</option>
                      ) : (
                        <>
                          <option value="">Select project</option>
                          {filteredProjects.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.project_name} ({p.project_code || 'No Code'})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  <div></div>
                </div>

                {/* Grid 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PURPOSE</label>
                      <button 
                        type="button"
                        onClick={() => setIsAddPurposeModalOpen(true)}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Purpose
                      </button>
                    </div>
                    <select
                      value={formData.purpose_of_visit}
                      onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="">Select purpose</option>
                      {purposes?.map((purpose: any) => (
                        <option key={purpose.id} value={purpose.name}>{purpose.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ENGINEER / ASSIGNED TO</label>
                    <input
                      type="text"
                      value={formData.engineer}
                      onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                      placeholder="Engineer name"
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>
                </div>

                {/* Grid 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT TIME</label>
                    <input
                      type="time"
                      value={formData.visit_time}
                      onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PO / WO / CONTRACT</label>
                    <input
                      type="text"
                      value={formData.po_wo_contract}
                      onChange={(e) => setFormData({ ...formData, po_wo_contract: e.target.value })}
                      placeholder="PO/WO Number"
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>
                </div>

                {/* Grid 4 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT MANAGER</label>
                    <select
                      value={formData.project_manager_id}
                      onChange={(e) => setFormData({ ...formData, project_manager_id: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="">Select manager</option>
                      {projectManagers?.map((pm: any) => (
                        <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT TYPE</label>
                    <select
                      value={formData.visit_type}
                      onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      {['Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other'].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRIORITY</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="Standard">Standard</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                {/* Site Contact Details */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '14px', background: '#fafafa' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Contact Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>PERSON NAME</label>
                      <input
                        type="text"
                        value={formData.site_contact_person}
                        onChange={(e) => setFormData({ ...formData, site_contact_person: e.target.value })}
                        placeholder="Contact person"
                        style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>PHONE NUMBER</label>
                      <input
                        type="text"
                        value={formData.site_contact_phone}
                        onChange={(e) => setFormData({ ...formData, site_contact_phone: e.target.value })}
                        placeholder="Phone number"
                        style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>DESIGNATION</label>
                      <input
                        type="text"
                        value={formData.site_contact_designation}
                        onChange={(e) => setFormData({ ...formData, site_contact_designation: e.target.value })}
                        placeholder="e.g. Site Engineer"
                        style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Requirements & Restrictions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PPE REQUIREMENTS</label>
                    <input
                      type="text"
                      value={formData.ppe_requirements}
                      onChange={(e) => setFormData({ ...formData, ppe_requirements: e.target.value })}
                      placeholder="e.g. Helmet, Safety Shoes"
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACCESS RESTRICTIONS</label>
                    <input
                      type="text"
                      value={formData.access_restrictions}
                      onChange={(e) => setFormData({ ...formData, access_restrictions: e.target.value })}
                      placeholder="e.g. Work permit required"
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>
                </div>

                {/* Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SITE ADDRESS</label>
                  <textarea
                    value={formData.site_address}
                    onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                    placeholder="Enter site address..."
                    style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', minHeight: '60px', resize: 'vertical' }}
                  />
                </div>

                {/* Chargeable Checkbox */}
                <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="is_chargeable"
                    checked={formData.is_chargeable}
                    onChange={(e) => setFormData({ ...formData, is_chargeable: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is_chargeable" style={{ fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                    This visit is chargeable to the client
                  </label>
                </div>

              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e5e5',
              }}>
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '6px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                {!selectedVisit && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saveVisit.isPending}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '6px',
                      background: '#f5f5f5',
                      color: '#525252',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: saveVisit.isPending ? 'not-allowed' : 'pointer',
                      opacity: saveVisit.isPending ? 0.6 : 1,
                    }}
                  >
                    {saveVisit.isPending ? 'Saving...' : 'Save as Draft'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saveVisit.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    background: selectedVisit ? '#171717' : '#2563eb',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: saveVisit.isPending ? 'not-allowed' : 'pointer',
                    opacity: saveVisit.isPending ? 0.6 : 1,
                  }}
                >
                  {saveVisit.isPending
                    ? 'Saving...'
                    : selectedVisit
                    ? 'Update Visit'
                    : 'Create Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purpose Dialog */}
      <Dialog open={isAddPurposeModalOpen} onOpenChange={setIsAddPurposeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Purpose</DialogTitle>
            <DialogDescription>
              Create a new purpose for site visits.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs font-semibold mb-2 block uppercase tracking-wide">Purpose Name</Label>
            <Input
              value={newPurposeName}
              onChange={(e) => setNewPurposeName(e.target.value)}
              placeholder="e.g. Site Audit, Quality Check"
              className="w-full"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsAddPurposeModalOpen(false); setNewPurposeName(''); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newPurposeName.trim()) return;
                addPurposeMutation.mutate(newPurposeName);
                setNewPurposeName('');
              }}
              disabled={addPurposeMutation.isPending}
              className="bg-black hover:bg-black/90 text-white"
            >
              {addPurposeMutation.isPending ? 'Saving...' : 'Save Purpose'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Site Visit Update Modal (Detailed) */}
      {isUpdateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>Site Visit Update</h3>
                <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Comprehensive update for site operations</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsUpdateModalOpen(false); resetForm(); }}
                style={{ padding: '8px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Select Visit (Optional if new, required if update) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SELECT VISIT TO UPDATE</label>
                    <select
                      value={selectedVisit?.id || ''}
                      onChange={(e) => {
                        const visit = visits?.find((v: any) => v.id === e.target.value);
                        if (visit) handleEditVisit(visit);
                      }}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">-- Choose existing visit --</option>
                      {visits?.slice(0, 20).map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {format(parseISO(v.visit_date), 'dd MMM')} - {v.clients?.client_name} ({v.purpose_of_visit})
                        </option>
                      ))}
                    </select>
                  </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT *</label>
                    <CustomSelect
                      value={formData.client_id}
                      onChange={handleClientChange}
                      placeholder="Select client"
                      options={clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || []}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT</label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      {(!formData.client_id || filteredProjects.length === 0) ? (
                        <option value="" disabled>No active projects for this client</option>
                      ) : (
                        <>
                          <option value="">Select project</option>
                          {filteredProjects.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.project_name} ({p.project_code || 'No Code'})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IN TIME</label>
                      <input
                        type="time"
                        value={formData.visit_time}
                        onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OUT TIME</label>
                      <input
                        type="time"
                        value={formData.out_time}
                        onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISITED BY</label>
                    <input
                      type="text"
                      value={formData.visited_by}
                      onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                      placeholder="Person who visited"
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SITE ADDRESS</label>
                    <textarea
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="Physical site location..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DISCUSSION POINTS</label>
                    <textarea
                      value={formData.discussion_points}
                      onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                      placeholder="Summary of site meeting/observations..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '100px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EQUIPMENT USED</label>
                    <textarea
                      value={formData.equipment_used}
                      onChange={(e) => setFormData({ ...formData, equipment_used: e.target.value })}
                      placeholder="Tools and equipment..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SAFETY HAZARDS IDENTIFIED</label>
                    <textarea
                      value={formData.safety_hazards}
                      onChange={(e) => setFormData({ ...formData, safety_hazards: e.target.value })}
                      placeholder="List safety concerns..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RECOMMENDATIONS</label>
                    <textarea
                      value={formData.recommendations}
                      onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                      placeholder="Actionable site recommendations..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT DATE *</label>
                    <input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      required
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ENGINEER / ASSIGNED TO</label>
                    <input
                      type="text"
                      value={formData.engineer}
                      onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                      placeholder="Engineer name"
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PURPOSE</label>
                      <button type="button" onClick={() => setIsAddPurposeModalOpen(true)} style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add New</button>
                    </div>
                    <select
                      value={formData.purpose_of_visit}
                      onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">Select purpose</option>
                      {purposes?.map((p: any) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FOLLOW UP DATE</label>
                      <input
                        type="date"
                        value={formData.follow_up_date}
                        onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LOCATION URL</label>
                      <input
                        type="url"
                        value={formData.location_url}
                        onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                        placeholder="Google Maps link"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NEXT STEP</label>
                    <select
                      value={formData.next_step}
                      onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">Select next action</option>
                      <option value="Quote to be Sent">Quote to be Sent</option>
                      <option value="Follow up call">Follow up call</option>
                      <option value="Second Visit">Second Visit</option>
                      <option value="Order Confirmation">Order Confirmation</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MEASUREMENTS</label>
                    <textarea
                      value={formData.measurements}
                      onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                      placeholder="Technical measurements or dimensions..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>WEATHER CONDITIONS</label>
                    <input
                      type="text"
                      value={formData.weather_conditions}
                      onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                      placeholder="e.g. Sunny, Rainy"
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TRAVEL TIME (MINS)</label>
                      <input
                        type="number"
                        value={formData.travel_time_minutes || ''}
                        onChange={(e) => setFormData({ ...formData, travel_time_minutes: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Minutes"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL MAN HOURS</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.total_man_hours || ''}
                        onChange={(e) => setFormData({ ...formData, total_man_hours: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="Man hours"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  {/* Expenses details */}
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '14px', background: '#fafafa' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#404040', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visit Expenses</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>TRAVEL</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.travel_expense || ''}
                          onChange={(e) => setFormData({ ...formData, travel_expense: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="₹ 0.00"
                          style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>STAY</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.accommodation_expense || ''}
                          onChange={(e) => setFormData({ ...formData, accommodation_expense: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="₹ 0.00"
                          style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>MISC</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.misc_expense || ''}
                          onChange={(e) => setFormData({ ...formData, misc_expense: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="₹ 0.00"
                          style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="postponed">Postponed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {formData.status === 'postponed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REASON FOR POSTPONEMENT</label>
                      <textarea
                        value={formData.postponed_reason}
                        onChange={(e) => setFormData({ ...formData, postponed_reason: e.target.value })}
                        placeholder="Why was this visit delayed?"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="is_client_meeting"
                        checked={formData.is_client_meeting}
                        onChange={(e) => setFormData({ ...formData, is_client_meeting: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="is_client_meeting" style={{ fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                        Mark as Client Meeting
                      </label>
                    </div>
                    {formData.is_client_meeting && (
                      <p style={{ fontSize: '12px', color: '#6b7280', marginLeft: '24px' }}>
                        This will create a meeting record and allow you to add meeting minutes
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #f0f0f0',
              }}>
                <button
                  type="button"
                  onClick={() => { setIsUpdateModalOpen(false); resetForm(); }}
                  style={{ flex: 1, padding: '12px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveVisit.isPending}
                  style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: '#171717', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {saveVisit.isPending ? 'Processing...' : selectedVisit ? 'Update Records' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'updates' && (
        <>
          <SiteVisitUpdatesView 
            visits={paginatedUpdates} 
            onEdit={handleEditVisit}
            onDelete={handleDeleteVisit}
            onView={(v: any) => setVisitToView(v)}
          />
          {updatesTotalPages >= 1 && (
            <PaginationBar
              currentPage={updatesPage}
              totalPages={updatesTotalPages}
              totalItems={filteredVisits.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setUpdatesPage}
            />
          )}
        </>
      )}

      {viewMode === 'calendar' && (
        <CalendarView 
          visits={filteredVisits || []}
          onDateClick={(date) => {
            setSelectedDate(date);
            setIsFormOpen(true);
            setFormData(prev => ({ ...prev, visit_date: format(date, 'yyyy-MM-dd') }));
          }}
          onVisitClick={(visit) => setVisitToView(visit)}
        />
      )}

      {/* View Visit Modal */}
      {visitToView && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setVisitToView(null)}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '95%',
            maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
                Site Visit Details
              </h3>
              <button onClick={() => setVisitToView(null)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px', border: 'none', background: 'transparent',
                color: '#525252', cursor: 'pointer', borderRadius: '4px',
              }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Section 1: Scheduling Details */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                  1. Scheduling & Site Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.clients?.client_name || 'N/A'}</div>
                  </div>
                  {visitToView.lead && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Lead</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#185FA5', marginTop: '2px' }}>
                        {visitToView.lead.contact_name}
                        {visitToView.lead.company_name ? ` (${visitToView.lead.company_name})` : ''}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visit Date & Time</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        {visitToView.visit_date ? format(parseISO(visitToView.visit_date), 'dd MMM yyyy') : '--'} {visitToView.visit_time ? `@ ${visitToView.visit_time}` : ''}
                      </div>
                      {visitToView.visit_date && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                          <button
                            type="button"
                            onClick={() => handleAddToGoogleCalendar(visitToView)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              border: '1px solid #dbeafe',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#1e40af',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#dbeafe';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#eff6ff';
                            }}
                          >
                            <CalendarIcon size={12} />
                            Google Cal (Opt 1)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadIcsFile(visitToView)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              border: '1px solid #d1fae5',
                              borderRadius: '4px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#d1fae5';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#ecfdf5';
                            }}
                          >
                            <Download size={12} />
                            Download .ics (Opt 2)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Purpose of Visit</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.purpose_of_visit || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                    <div style={{ marginTop: '4px' }}>
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        visitToView.status === 'completed' ? 'bg-green-100 text-green-700' :
                        visitToView.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        visitToView.status === 'postponed' ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-100 text-zinc-600'
                      )}>{visitToView.status}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visited By / Engineer</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.engineer || visitToView.visited_by || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Manager</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                      {(() => {
                        const pm = projectManagers?.find((p: any) => p.id === visitToView.project_manager_id);
                        return pm ? (pm.full_name || pm.email) : '--';
                      })()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visit Type</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.visit_type || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.priority || 'Standard'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PO / WO / Contract</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.po_wo_contract || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Is Chargeable</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.is_chargeable ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PPE Requirements</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.ppe_requirements || 'None'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Access Restrictions</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.access_restrictions || 'None'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Contact Info</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                      {visitToView.site_contact_person ? `${visitToView.site_contact_person} (${visitToView.site_contact_designation || 'Contact'}) - ${visitToView.site_contact_phone || 'No phone'}` : '--'}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Address</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.site_address || '--'}</div>
                  </div>
                </div>
              </div>
 
              {/* Section 2: Operational Report */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                  2. Site Operations & Reports
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Out Time</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.out_time || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weather Conditions</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.weather_conditions || '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Travel Time</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.travel_time_minutes ? `${visitToView.travel_time_minutes} mins` : '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Man Hours</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.total_man_hours ? `${visitToView.total_man_hours} hrs` : '--'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipment / Tools Used</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.equipment_used || '--'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Safety Hazards Identified</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.safety_hazards || '--'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discussion Points / MoM</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.discussion_points || '--'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Measurements / Dimensions</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.measurements || '--'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommendations</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visitToView.recommendations || '--'}</div>
                  </div>
                </div>
              </div>
 
              {/* Section 3: Expenses */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                  3. Expense Tracking & Logistics
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Travel Expense</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.travel_expense ? `₹ ${visitToView.travel_expense.toFixed(2)}` : '₹ 0.00'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stay Expense</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.accommodation_expense ? `₹ ${visitToView.accommodation_expense.toFixed(2)}` : '₹ 0.00'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Misc Expense</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visitToView.misc_expense ? `₹ ${visitToView.misc_expense.toFixed(2)}` : '₹ 0.00'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Expense</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                      ₹ {((visitToView.travel_expense || 0) + (visitToView.accommodation_expense || 0) + (visitToView.misc_expense || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Location & Geotag Verification */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                  4. Location & Geotag Verification
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check In Status</div>
                    {visitToView.check_in_time ? (
                      <div style={{ fontSize: '13px', color: '#171717', marginTop: '4px' }}>
                        <span style={{ fontWeight: 600 }}>Checked In: </span>
                        {format(parseISO(visitToView.check_in_time), 'dd MMM yyyy, h:mm a')}
                        {visitToView.check_in_lat ? (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            Coordinates: {Number(visitToView.check_in_lat).toFixed(5)}, {Number(visitToView.check_in_lng).toFixed(5)}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
                            ⚠️ Location Denied
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleCheckIn(visitToView)}
                          className="pl-btn pl-btn-primary"
                          style={{ fontSize: '12px', padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none' }}
                        >
                          Check In (Start Visit)
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check Out Status</div>
                    {visitToView.check_out_time ? (
                      <div style={{ fontSize: '13px', color: '#171717', marginTop: '4px' }}>
                        <span style={{ fontWeight: 600 }}>Checked Out: </span>
                        {format(parseISO(visitToView.check_out_time), 'dd MMM yyyy, h:mm a')}
                        {visitToView.check_out_lat ? (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            Coordinates: {Number(visitToView.check_out_lat).toFixed(5)}, {Number(visitToView.check_out_lng).toFixed(5)}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            No GPS Coordinates captured
                          </div>
                        )}
                        {visitToView.signed_off_by && (
                          <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Client Sign-off:</div>
                            <div style={{ fontSize: '12px', color: '#1e293b' }}>
                              {visitToView.signed_off_by} ({visitToView.signed_off_designation})
                            </div>
                            {visitToView.signature_image_url && (
                              <div style={{ marginTop: '6px' }}>
                                <img
                                  src={visitToView.signature_image_url}
                                  alt="Client Signature"
                                  style={{ border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', maxHeight: '50px', maxWidth: '150px' }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px' }}>
                        {visitToView.check_in_time ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckoutData({ signed_off_by: '', signed_off_designation: '' });
                              setChecklistAnswers({});
                              setJmsItems([]);
                              setJmsSubcontractorId('');
                              setTcEquipmentId('');
                              setTcTestType('');
                              setTcWitnessedBy('');
                              setTcReadings([]);
                              setObservationOpen(false);
                              setObservationCategory('');
                              setObservationTitle('');
                              setIsCheckoutModalOpen(true);
                            }}
                            className="pl-btn pl-btn-primary"
                            style={{ fontSize: '12px', padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none' }}
                          >
                            Check Out (Sign-off)
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                            Please check in first.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Saved Checklist Responses */}
                {savedChecklist.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Checklist Responses</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      {savedChecklist.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: '12px', color: '#374151' }}>{item.question_text}</span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: item.answer === 'Yes' ? '#047857' : item.answer === 'No' ? '#b91c1c' : '#4b5563',
                            background: item.answer === 'Yes' ? '#d1fae5' : item.answer === 'No' ? '#fee2e2' : '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>{item.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Joint Measurement Sheet */}
              {visitJms && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                    5. Joint Measurement Sheet (JMS)
                  </h4>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '6px' }}>Subcontractor:</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>
                      {visitJms.subcontractor?.company_name || 'Direct / None'}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Item Description</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '80px' }}>Unit</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'right' }}>Agreed Qty</th>
                          {['Project Manager', 'Admin'].includes(userRole) && (
                            <>
                              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'right' }}>Rate</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px', textAlign: 'right' }}>Amount</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(visitJms.measured_items) && visitJms.measured_items.map((item: any, idx: number) => {
                          const qty = Number(item.agreed_qty || 0);
                          const rate = Number(item.rate || 0);
                          const amount = qty * rate;
                          return (
                            <tr key={idx} style={{ borderBottom: idx < visitJms.measured_items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{item.item_name}</td>
                              <td style={{ padding: '8px 12px', color: '#475569' }}>{item.unit}</td>
                              <td style={{ padding: '8px 12px', color: '#1e293b', textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                              {['Project Manager', 'Admin'].includes(userRole) && (
                                <>
                                  <td style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                  <td style={{ padding: '8px 12px', color: '#16a34a', textAlign: 'right', fontWeight: 600 }}>₹{amount.toFixed(2)}</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                        {['Project Manager', 'Admin'].includes(userRole) && Array.isArray(visitJms.measured_items) && (
                          <tr style={{ background: '#f8fafc', borderTop: '1.5px solid #e5e7eb' }}>
                            <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>Total JMS Amount</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                              {visitJms.measured_items.reduce((sum: number, itm: any) => sum + Number(itm.agreed_qty || 0), 0)}
                            </td>
                            <td style={{ padding: '8px 12px' }}></td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              ₹{visitJms.measured_items.reduce((sum: number, itm: any) => sum + (Number(itm.agreed_qty || 0) * Number(itm.rate || 0)), 0).toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 6: T&C Protocols */}
              {visitTc && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '12px' }}>
                    6. Testing & Commissioning (T&C) Protocol
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 16px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipment</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                        {visitTc.equipment?.equipment_name || 'Linked Equipment'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Protocol Type</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                        {visitTc.test_type}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Witness Representative</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                        {visitTc.witnessed_by_client || 'None / N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Parameter Name</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px' }}>Required Value</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px' }}>Actual Value</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(visitTc.readings) && visitTc.readings.map((reading: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: idx < visitTc.readings.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{reading.parameter}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{reading.required_value}</td>
                            <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{reading.actual_value}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: reading.status === 'Pass' ? '#047857' : reading.status === 'Fail' ? '#b91c1c' : '#4b5563',
                                background: reading.status === 'Pass' ? '#d1fae5' : reading.status === 'Fail' ? '#fee2e2' : '#f3f4f6',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                {reading.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Checkout & Signature Modal */}
              {isCheckoutModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
                  <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Visit Checkout & Client Sign-off</h3>
                      <button onClick={() => setIsCheckoutModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                        <X size={20} />
                      </button>
                    </div>
                    <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Checklist Section */}
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visit Checklist</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {getChecklistQuestions(visitToView?.visit_type || '').map((q: any) => (
                            <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.875rem', color: '#334155' }}>{q.text}</span>
                              <select
                                className="pl-input"
                                value={checklistAnswers[q.id] || 'Yes'}
                                onChange={e => setChecklistAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                style={{ width: '80px', padding: '0.25rem', fontSize: '0.8125rem' }}
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="N/A">N/A</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

                      {/* Joint Measurement Sheet (JMS) Section */}
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joint Measurement Sheet (JMS)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Subcontractor Link (Optional)</label>
                            <select
                              className="pl-input"
                              value={jmsSubcontractorId}
                              onChange={e => setJmsSubcontractorId(e.target.value)}
                              style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                            >
                              <option value="">Select Subcontractor</option>
                              {subcontractors.map((sub: any) => (
                                <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Measured Items</span>
                              <button
                                type="button"
                                onClick={() => setJmsItems(prev => [...prev, { item_name: '', unit: 'm', agreed_qty: 0, rate: 0 }])}
                                className="pl-btn"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', cursor: 'pointer' }}
                              >
                                + Add Row
                              </button>
                            </div>
                            
                            {jmsItems.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>No measurement items logged yet. Add rows if materials were verified on site.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {jmsItems.map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="Item Description"
                                      className="pl-input"
                                      value={item.item_name}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setJmsItems(prev => prev.map((itm, i) => i === idx ? { ...itm, item_name: val } : itm));
                                      }}
                                      style={{ flex: 2, fontSize: '0.75rem', padding: '0.25rem' }}
                                      required
                                    />
                                    <input
                                      type="text"
                                      placeholder="Unit"
                                      className="pl-input"
                                      value={item.unit}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setJmsItems(prev => prev.map((itm, i) => i === idx ? { ...itm, unit: val } : itm));
                                      }}
                                      style={{ width: '50px', fontSize: '0.75rem', padding: '0.25rem' }}
                                      required
                                    />
                                    <input
                                      type="number"
                                      placeholder="Qty"
                                      className="pl-input"
                                      value={item.agreed_qty || ''}
                                      onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setJmsItems(prev => prev.map((itm, i) => i === idx ? { ...itm, agreed_qty: val } : itm));
                                      }}
                                      style={{ width: '60px', fontSize: '0.75rem', padding: '0.25rem' }}
                                      required
                                    />
                                    <input
                                      type="number"
                                      placeholder="Rate"
                                      className="pl-input"
                                      value={item.rate || ''}
                                      onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setJmsItems(prev => prev.map((itm, i) => i === idx ? { ...itm, rate: val } : itm));
                                      }}
                                      style={{ width: '70px', fontSize: '0.75rem', padding: '0.25rem' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setJmsItems(prev => prev.filter((_, i) => i !== idx))}
                                      style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

                      {/* Testing & Commissioning (T&C) Section */}
                      {(visitToView?.visit_type === 'Inspection' || visitToView?.visit_type === 'Testing' || visitToView?.visit_type === 'Audit') && (
                        <div>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Testing & Commissioning (T&C) Protocol</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Link to Equipment *</label>
                                <select
                                  className="pl-input"
                                  value={tcEquipmentId}
                                  onChange={e => setTcEquipmentId(e.target.value)}
                                  style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                                >
                                  <option value="">Select Equipment</option>
                                  {projectEquipment.map((eq: any) => (
                                    <option key={eq.id} value={eq.id}>
                                      {eq.equipment_name} {eq.serial_number ? `(S/N: ${eq.serial_number})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Client Witness Representative</label>
                                <input
                                  type="text"
                                  className="pl-input"
                                  placeholder="e.g. Client Consultant"
                                  value={tcWitnessedBy}
                                  onChange={e => setTcWitnessedBy(e.target.value)}
                                  style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                                />
                              </div>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Test Protocol Type *</label>
                              <select
                                className="pl-input"
                                value={tcTestType}
                                onChange={e => {
                                  const val = e.target.value;
                                  setTcTestType(val);
                                  // Pre-populate parameters based on test type
                                  if (val === 'Hydrostatic Pressure Test') {
                                    setTcReadings([
                                      { parameter: 'Pressure Hold Time', required_value: '2 hours', actual_value: '', status: 'Pass' },
                                      { parameter: 'Operating Pressure', required_value: '10 bar', actual_value: '', status: 'Pass' },
                                      { parameter: 'Pressure Drop', required_value: '0 bar', actual_value: '', status: 'Pass' }
                                    ]);
                                  } else if (val === 'Electrical Insulation Megger') {
                                    setTcReadings([
                                      { parameter: 'Insulation Resistance', required_value: '> 100 MΩ', actual_value: '', status: 'Pass' },
                                      { parameter: 'Starting Current', required_value: '< 50 A', actual_value: '', status: 'Pass' },
                                      { parameter: 'Voltage Unbalance', required_value: '< 2%', actual_value: '', status: 'Pass' }
                                    ]);
                                  } else {
                                    setTcReadings([]);
                                  }
                                }}
                                style={{ width: '100%', fontSize: '0.8125rem', padding: '0.375rem' }}
                              >
                                <option value="">Select Test Type</option>
                                <option value="Hydrostatic Pressure Test">Hydrostatic Pressure Test (Piping)</option>
                                <option value="Electrical Insulation Megger">Electrical Insulation Megger (Cables)</option>
                                <option value="Air Velocity Test">Air Velocity Test (HVAC Ducting)</option>
                                <option value="Custom Verification Protocol">Custom Verification Protocol</option>
                              </select>
                            </div>

                            {tcTestType && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Test Parameters & Readings</span>
                                  <button
                                    type="button"
                                    onClick={() => setTcReadings(prev => [...prev, { parameter: '', required_value: '', actual_value: '', status: 'Pass' }])}
                                    className="pl-btn"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', cursor: 'pointer' }}
                                  >
                                    + Add Parameter
                                  </button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {tcReadings.map((reading, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input
                                        type="text"
                                        placeholder="Parameter"
                                        className="pl-input"
                                        value={reading.parameter}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, parameter: val } : r));
                                        }}
                                        style={{ flex: 2, fontSize: '0.75rem', padding: '0.25rem' }}
                                        required
                                      />
                                      <input
                                        type="text"
                                        placeholder="Req. Value"
                                        className="pl-input"
                                        value={reading.required_value}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, required_value: val } : r));
                                        }}
                                        style={{ width: '80px', fontSize: '0.75rem', padding: '0.25rem' }}
                                        required
                                      />
                                      <input
                                        type="text"
                                        placeholder="Act. Value"
                                        className="pl-input"
                                        value={reading.actual_value}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, actual_value: val } : r));
                                        }}
                                        style={{ width: '80px', fontSize: '0.75rem', padding: '0.25rem' }}
                                        required
                                      />
                                      <select
                                        className="pl-input"
                                        value={reading.status}
                                        onChange={e => {
                                          const val = e.target.value as 'Pass' | 'Fail' | 'Pending';
                                          setTcReadings(prev => prev.map((r, i) => i === idx ? { ...r, status: val } : r));
                                        }}
                                        style={{ width: '70px', fontSize: '0.75rem', padding: '0.25rem' }}
                                      >
                                        <option value="Pass">Pass</option>
                                        <option value="Fail">Fail</option>
                                        <option value="Pending">Pending</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => setTcReadings(prev => prev.filter((_, i) => i !== idx))}
                                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

                      {/* Site Observation Section (Optional) */}
                      <div>
                        <div 
                          onClick={() => setObservationOpen(!observationOpen)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '0.5rem' }}
                        >
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{observationOpen ? '▼' : '▶'}</span>
                            Log Site Observation (Optional)
                          </h4>
                          {!observationOpen && (observationTitle || observationCategory) && (
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>Added ✓</span>
                          )}
                        </div>

                        {observationOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.375rem' }}>Category *</label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                {[
                                  { label: 'Improvement Opportunity', val: 'Improvement Opportunity' },
                                  { label: 'Best Practice', val: 'Best Practice' },
                                  { label: 'Client Feedback', val: 'Client Feedback' },
                                  { label: 'Coordination Issue', val: 'Coordination Issue' },
                                  { label: 'Safety Observation', val: 'Safety Observation' },
                                  { label: 'Cost Saving Idea', val: 'Cost Saving Idea' }
                                ].map(cat => (
                                  <label key={cat.val} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#334155', cursor: 'pointer' }}>
                                    <input
                                      type="radio"
                                      name="obs_category"
                                      value={cat.val}
                                      checked={observationCategory === cat.val}
                                      onChange={e => setObservationCategory(e.target.value)}
                                    />
                                    {cat.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Title *</label>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="pl-input"
                                  placeholder="e.g. Wrong flange size delivered for floor 4"
                                  value={observationTitle}
                                  onChange={e => setObservationTitle(e.target.value)}
                                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.375rem' }}
                                />
                                <button
                                  type="button"
                                  onClick={startListening}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.375rem',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: isListening ? '#fee2e2' : '#f8fafc',
                                    color: isListening ? '#ef4444' : '#475569',
                                    cursor: 'pointer',
                                    width: '32px',
                                    height: '32px',
                                  }}
                                  title={isListening ? 'Listening...' : 'Dictate Title'}
                                >
                                  <Mic size={14} style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }} />
                                </button>
                              </div>
                              
                              {/* Quick Suggestions for MEP Engineers */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                                {[
                                  'Material dimension mismatch',
                                  'Vendor supply delay',
                                  'Drawing revision mismatch',
                                  'Power / utility shut-off',
                                  'Pressure test passed',
                                  'Safety hazard detected'
                                ].map(template => (
                                  <button
                                    key={template}
                                    type="button"
                                    onClick={() => setObservationTitle(template)}
                                    style={{
                                      fontSize: '0.625rem',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      border: '1px solid #e2e8f0',
                                      background: '#fff',
                                      color: '#64748b',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    {template}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

                      {/* Client Sign-off Fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Client Representative Name *</label>
                          <input
                            type="text"
                            required
                            className="pl-input"
                            value={checkoutData.signed_off_by}
                            onChange={e => setCheckoutData(prev => ({ ...prev, signed_off_by: e.target.value }))}
                            style={{ width: '100%' }}
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Designation *</label>
                          <input
                            type="text"
                            required
                            className="pl-input"
                            value={checkoutData.signed_off_designation}
                            onChange={e => setCheckoutData(prev => ({ ...prev, signed_off_designation: e.target.value }))}
                            style={{ width: '100%' }}
                            placeholder="e.g. Site Manager"
                          />
                        </div>
                      </div>

                      {/* Drawing Canvas */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Digital Signature *</label>
                        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
                          <canvas
                            ref={canvasRef}
                            width={500}
                            height={150}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            style={{ display: 'block', width: '100%', height: '150px', cursor: 'crosshair', background: '#fff' }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="pl-btn"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                          >
                            Clear signature
                          </button>
                        </div>
                      </div>

                    </div>
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                      <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkoutData.signed_off_by || !checkoutData.signed_off_designation) {
                            alert('Please enter representative name and designation.');
                            return;
                          }
                          handleCheckOut(visitToView);
                        }}
                        className="pl-btn pl-btn-primary"
                      >
                        Submit Sign-off & Checkout
                      </button>
                    </div>
                  </div>
                </div>
              )}

 
              {/* Activity Log Section */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Activity size={14} color="#6b7280" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity Log</span>
                </div>
                {visitActivityLoading ? (
                  <div style={{ fontSize: '13px', color: '#999', padding: '8px 0' }}>Loading...</div>
                ) : visitActivityLogs.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#999', padding: '8px 0' }}>No activity recorded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {visitActivityLogs.map((log: any) => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db', marginTop: '6px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>{log.title}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{log.description}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            {log.actor_name} &middot; {log.created_at ? format(parseISO(log.created_at), 'dd MMM yyyy, h:mm a') : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '16px 20px',
              borderTop: '1px solid #e5e5e5',
              background: '#fafafa',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setVisitToView(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginRight: 'auto',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadVisitPDF(visitToView)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  handleEditVisit(visitToView);
                  setVisitToView(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Edit2 size={14} />
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Activity Log Modal */}
      {isGlobalActivityOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px',
            width: '95%', maxWidth: '650px', maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#171717', margin: 0 }}>
                <Activity size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#6b7280' }} />
                Activity Log
              </h3>
              <button onClick={() => setIsGlobalActivityOpen(false)}
                style={{ padding: '6px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {globalActivityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : globalActivityLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                  <Activity size={24} />
                  <p className="text-sm font-medium">No activity recorded yet</p>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {globalActivityLogs.map((log: any, idx: number) => (
                    <div key={log.id || idx} style={{ display: 'flex', gap: '12px', paddingBottom: idx < globalActivityLogs.length - 1 ? '16px' : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: log.event_type?.includes('created') ? '#16a34a' :
                            log.event_type?.includes('updated') ? '#3b82f6' :
                            log.event_type?.includes('deleted') ? '#ef4444' : '#6b7280',
                          flexShrink: 0, marginTop: '4px',
                        }} />
                        {idx < globalActivityLogs.length - 1 && (
                          <div style={{ width: '1px', flex: 1, background: '#e5e7eb', marginTop: '4px' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#171717', margin: 0 }}>
                            {log.title || 'Activity'}
                          </p>
                          <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                            {log.created_at ? format(parseISO(log.created_at), 'dd MMM HH:mm') : ''}
                          </span>
                        </div>
                        {log.description && (
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                            {log.description}
                          </p>
                        )}
                        {log.actor_name && (
                          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>
                            by {log.actor_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
