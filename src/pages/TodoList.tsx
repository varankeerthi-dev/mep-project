import React, { useState, useMemo, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  MoreHorizontal, 
  User, 
  Clock, 
  Trash2,
  ChevronDown,
  Filter,
  CheckCircle,
  Inbox,
  PlayCircle,
  Lightbulb,
  X,
  ArrowRight,
  Calendar as CalendarIcon,
  Bell,
  Info,
  Layout,
  Table,
  BarChart2
} from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../App'

const STATUSES = [
  { id: 'To Do', label: 'To Do', icon: <Circle size={16} className="text-gray-400" />, bgColor: 'bg-transparent' },
  { id: 'In Progress', label: 'In Progress', icon: <PlayCircle size={16} className="text-blue-500" />, bgColor: 'bg-transparent' },
  { id: 'On Hold', label: 'On Hold', icon: <Clock size={16} className="text-orange-500" />, bgColor: 'bg-transparent' },
  { id: 'Review', label: 'Review', icon: <CheckCircle size={16} className="text-purple-500" />, bgColor: 'bg-transparent' },
  { id: 'Completed', label: 'Completed', icon: <CheckCircle2 size={16} className="text-green-500" />, bgColor: 'bg-transparent' }
]

const CLIENT_TYPES = [
  { id: 'order', label: 'Order', icon: '📦', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
  { id: 'complaint', label: 'Complaint', icon: '⚠️', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300' },
  { id: 'followup', label: 'Follow-up', icon: '📞', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' }
]

const TABS = [
  { id: 'team', label: 'Team Task', icon: <User size={16} />, color: 'bg-blue-600' },
  { id: 'personal', label: 'Personal Task', icon: <User size={16} />, color: 'bg-emerald-600' },
  { id: 'idea', label: 'Idea Tab', icon: <Lightbulb size={16} />, color: 'bg-purple-600' },
  { id: 'reminders', label: 'Reminders', icon: <Bell size={16} />, color: 'bg-rose-600' }
]

export default function TodoList() {
  const { user, organisation } = useAuth()
  const [tasks, setTasks] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('team')
  const [viewMode, setViewMode] = useState('board')
  const [showAddModal, setShowAddModal] = useState(false)
  const [inlineInputs, setInlineInputs] = useState({})
  const [inlineDates, setInlineDates] = useState({})
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [clientFilter, setClientFilter] = useState('all')
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'To Do',
    assigned_to: [],
    is_personal: false,
    category: 'task',
    due_date: null,
    priority: 'normal',
    notes: '',
    client_name: '',
    client_type: null
  })

  // Fetch tasks
  useEffect(() => {
    fetchTasks()
    fetchReminders()
  }, [organisation?.id])

  const fetchTasks = async () => {
    if (!organisation?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false })
    
    if (!error) setTasks(data || [])
    setLoading(false)
  }

  const fetchReminders = async () => {
    if (!organisation?.id) return
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false })
    
    setReminders(data || [])
  }

  const filteredTasks = useMemo(() => {
    let tasksToFilter = tasks
    
    if (activeTab === 'idea') {
      tasksToFilter = tasksToFilter.filter(t => t.category === 'idea')
    } else if (activeTab === 'personal') {
      tasksToFilter = tasksToFilter.filter(t => t.is_personal && t.category === 'task')
    } else {
      tasksToFilter = tasksToFilter.filter(t => !t.is_personal && t.category === 'task')
    }
    
    if (clientFilter !== 'all') {
      if (clientFilter === 'internal') {
        tasksToFilter = tasksToFilter.filter(t => !t.client_name && !t.client_type)
      } else {
        tasksToFilter = tasksToFilter.filter(t => t.client_type === clientFilter)
      }
    }
    
    return tasksToFilter
  }, [tasks, activeTab, clientFilter])

  const handleInlineCreate = async (status, e) => {
    if (e && e.key && e.key !== 'Enter') return
    
    if (inlineInputs[status]?.trim()) {
      const title = inlineInputs[status].trim()
      const dueDate = inlineDates[status] || null
      
      const { error } = await supabase.from('tasks').insert({
        title,
        status: status === 'Inbox' ? 'To Do' : status,
        is_personal: activeTab === 'personal',
        category: activeTab === 'idea' ? 'idea' : 'task',
        assigned_to: activeTab === 'personal' ? [user?.id] : [],
        due_date: dueDate,
        organisation_id: organisation?.id,
        created_by: user?.id
      })
      
      if (!error) {
        setInlineInputs({ ...inlineInputs, [status]: '' })
        setInlineDates({ ...inlineDates, [status]: null })
        fetchTasks()
      }
    }
  }

  const handleCreateTask = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!newTask.title.trim()) return
    
    const isIdea = activeTab === 'idea'
    const { error } = await supabase.from('tasks').insert({
      ...newTask,
      is_personal: isIdea ? false : (activeTab === 'personal'),
      category: isIdea ? 'idea' : 'task',
      organisation_id: organisation?.id,
      created_by: user?.id
    })
    
    if (!error) {
      setShowAddModal(false)
      setNewTask({
        title: '',
        description: '',
        status: 'To Do',
        assigned_to: [],
        is_personal: activeTab === 'personal',
        category: 'task',
        due_date: null,
        priority: 'normal',
        notes: '',
        client_name: '',
        client_type: null
      })
      fetchTasks()
    }
  }

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      e.target.style.opacity = '0.4'
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedTaskId(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    if (!draggedTaskId) return
    
    await supabase.from('tasks').update({ status: targetStatus }).eq('id', draggedTaskId)
    fetchTasks()
  }

  const toggleStatus = async (task) => {
    const statusFlow = {
      'To Do': 'In Progress',
      'In Progress': 'Review',
      'On Hold': 'In Progress',
      'Review': 'Completed',
      'Completed': 'To Do'
    }
    
    const newStatus = statusFlow[task.status] || 'To Do'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    fetchTasks()
  }

  const deleteTask = async (taskId) => {
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchTasks()
  }

  const formatDueDate = (date) => {
    if (!date) return null
    const d = new Date(date)
    return formatDistanceToNow(d, { addSuffix: true })
  }

  const getDueDateColor = (date) => {
    if (!date) return 'text-gray-400'
    const d = new Date(date)
    const now = new Date()
    if (d < now) return 'text-red-500 bg-red-50'
    const diff = d - now
    if (diff < 86400000) return 'text-amber-500 bg-amber-50'
    return 'text-gray-500 bg-gray-50'
  }

  const renderBoardView = () => (
    <div className="flex gap-4 h-full min-w-full [@media(min-width:1400px)]:flex-nowrap flex-wrap lg:flex-nowrap">
      {STATUSES.map(status => (
        <div 
          key={status.id} 
          className="flex flex-col min-w-[300px] flex-1 border-r border-gray-100 last:border-0"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status.id)}
        >
          <div className="px-3 py-3 flex items-center justify-between bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0">{status.icon}</span>
              <span className="text-sm font-semibold text-gray-800">{status.label}</span>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 font-medium">
                {filteredTasks.filter(t => t.status === status.id).length}
              </span>
            </div>
            <button className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors">
              <MoreHorizontal size={14} />
            </button>
          </div>

          <div className="flex-1 p-2 space-y-2 min-h-[400px] overflow-y-auto">
            <div className="group relative space-y-2 bg-transparent p-1 rounded-lg border border-transparent hover:border-gray-100 transition-all mb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Quick add task..."
                  className="w-full bg-transparent border-none focus:ring-0 rounded px-2 py-2 text-sm outline-none transition-all placeholder:text-gray-400"
                  value={inlineInputs[status.id] || ''}
                  onChange={(e) => setInlineInputs({ ...inlineInputs, [status.id]: e.target.value })}
                  onKeyDown={(e) => handleInlineCreate(status.id, e)}
                />
                {!inlineInputs[status.id] && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none transition-opacity group-focus-within:opacity-0">
                    <Plus size={14} />
                  </div>
                )}
              </div>

              {inlineInputs[status.id]?.trim() && (
                <div className="flex items-center gap-2 px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    type="date"
                    value={inlineDates[status.id] || ''}
                    onChange={(e) => setInlineDates({ ...inlineDates, [status.id]: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-gray-100 rounded text-[10px] focus:ring-1 focus:ring-blue-100 focus:border-blue-200 outline-none cursor-pointer hover:border-gray-200"
                  />
                  <button
                    onClick={() => handleInlineCreate(status.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded transition-all shadow-sm active:scale-95 flex-shrink-0"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {filteredTasks
              .filter(t => t.status === status.id)
              .map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className="group bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing relative"
                >
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleStatus(task)}
                      className={`mt-1 flex-shrink-0 transition-colors ${task.status === 'Completed' ? 'text-green-500' : 'text-gray-300 hover:text-gray-500'}`}
                    >
                      {task.status === 'Completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-[13px] font-500 text-gray-900 leading-snug break-words mb-2 ${task.status === 'Completed' ? 'line-through text-gray-400' : ''}`}>
                        {task.title}
                      </h4>
                      
                      {task.description && (
                        <p className="text-[12px] text-gray-600 line-clamp-1 leading-tight mb-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 mt-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(task.priority || 'normal') !== 'normal' && (
                            <div className="flex items-center" title={`Priority: ${task.priority}`}>
                              {task.priority === 'urgent' ? (
                                <span className="text-red-500 text-[10px]">🔴</span>
                              ) : (
                                <span className="text-orange-500 text-[10px]">⚠️</span>
                              )}
                            </div>
                          )}

                          {task.due_date && (
                            <div className={`flex items-center gap-1 text-[9px] ${getDueDateColor(task.due_date).includes('red') ? 'text-red-500' : 'text-gray-400'} font-medium`}>
                              <CalendarIcon size={10} />
                              <span>{formatDueDate(task.due_date)}</span>
                            </div>
                          )}

                          {(task.client_name || task.client_type) && (
                            <div className="flex items-center gap-1 text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                              <span className="text-[8px]">{task.client_type ? CLIENT_TYPES.find(ct => ct.id === task.client_type)?.icon : '👤'}</span>
                              <span className="truncate max-w-[60px]">{task.client_name || 'Client'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )

  const renderTableView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider">Task Title</th>
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider text-center">Priority</th>
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider">Client Info</th>
              <th className="px-6 py-4 text-[11px] text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/80">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-16 text-center text-gray-400 italic font-medium">No tasks found</td>
              </tr>
            ) : (
              filteredTasks.map(task => {
                const statusInfo = STATUSES.find(s => s.id === task.status) || STATUSES[0]
                const clientType = CLIENT_TYPES.find(ct => ct.id === task.client_type)
                
                return (
                  <tr key={task.id} className="hover:bg-indigo-50/30 transition-all group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleStatus(task)}
                          className={`flex-shrink-0 transition-colors ${task.status === 'Completed' ? 'text-green-500' : 'text-gray-300 hover:text-gray-500'}`}
                        >
                          {task.status === 'Completed' ? <CheckCircle size={18} /> : <Circle size={18} />}
                        </button>
                        <span className={`text-[13px] text-gray-800 ${task.status === 'Completed' ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] uppercase tracking-tight ${statusInfo.bgColor} ${
                        task.status === 'Completed' ? 'text-green-600' :
                        task.status === 'Review' ? 'text-purple-600' :
                        task.status === 'On Hold' ? 'text-amber-600' :
                        task.status === 'In Progress' ? 'text-orange-600' :
                        'text-blue-600'
                      } border border-current/10 shadow-sm`}>
                        {React.cloneElement(statusInfo.icon, { size: 10 })}
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-block text-[10px] uppercase px-2 py-0.5 rounded shadow-sm border ${
                        task.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' :
                        task.priority === 'high' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {task.priority || 'normal'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className={`flex items-center gap-1.5 text-[11px] ${getDueDateColor(task.due_date)} px-2 py-1 rounded-md border border-current/10 w-fit`}>
                        <Clock size={12} />
                        {task.due_date ? formatDueDate(task.due_date) : 'No deadline'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {task.client_name ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] text-gray-800 truncate max-w-[120px]">{task.client_name}</span>
                            {clientType && <span className="text-sm grayscale-0" title={clientType.label}>{clientType.icon}</span>}
                          </div>
                          <span className="text-[10px] text-gray-400">{clientType?.label || 'Direct Client'}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300 tracking-widest">- - -</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderIdeaTabView = () => (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border-2 border-gray-900 p-8">
        <h3 className="text-xl font-google-sans text-gray-900 mb-6 uppercase tracking-tight">Add New Idea</h3>
        <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Idea Title</label>
            <input
              type="text"
              placeholder="What's the core idea?"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-3 text-sm transition-all outline-none"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Description</label>
            <textarea
              placeholder="Describe the idea in detail..."
              rows="3"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-3 text-sm transition-all outline-none resize-none"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Remarks</label>
            <textarea
              placeholder="Any additional remarks or context?"
              rows="3"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-3 text-sm transition-all outline-none resize-none"
              value={newTask.notes}
              onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-none text-sm uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(79,70,229,0.2)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Save Idea
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border-2 border-indigo-200 overflow-hidden font-sans">
        <div className="bg-indigo-600 px-6 py-3 border-b-2 border-indigo-700">
          <h4 className="text-white text-xs uppercase tracking-widest flex items-center gap-2">
            <Lightbulb size={14} />
            Ideas Dashboard
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-indigo-200">
                <th className="px-6 py-4 text-[11px] text-gray-900 uppercase tracking-wider w-32">Date</th>
                <th className="px-6 py-4 text-[11px] text-gray-900 uppercase tracking-wider">Ideas</th>
                <th className="px-6 py-4 text-[11px] text-gray-900 uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-4 text-[11px] text-gray-900 uppercase tracking-wider text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400 italic font-medium">No ideas captured yet</td>
                </tr>
              ) : (
                filteredTasks.map(idea => (
                  <tr key={idea.id} className="hover:bg-purple-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-900">
                          {idea.created_at ? new Date(idea.created_at).toLocaleDateString() : 'Today'}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase">
                          {idea.created_at ? formatDistanceToNow(new Date(idea.created_at), { addSuffix: true }) : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-900 leading-tight">{idea.title}</span>
                        {idea.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{idea.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded shadow-sm">
                        <p className="text-xs text-amber-900 font-medium italic">
                          {idea.notes || 'No remarks'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => deleteTask(idea.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete Idea"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderDashboardView = () => {
    const stats = {
      total: filteredTasks.length,
      completed: filteredTasks.filter(t => t.status === 'Completed').length,
      inProgress: filteredTasks.filter(t => t.status === 'In Progress').length,
      todo: filteredTasks.filter(t => t.status === 'To Do').length,
      urgent: filteredTasks.filter(t => t.priority === 'urgent').length,
      overdue: filteredTasks.filter(t => {
        if (!t.due_date || t.status === 'Completed') return false
        return new Date(t.due_date) < new Date()
      }).length
    }

    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Total Tasks</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl text-gray-900">{stats.total}</span>
              <span className="text-sm text-indigo-500 mb-1">active</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Completion Rate</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl text-green-600">{completionRate}%</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Urgent Tasks</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl text-red-600">{stats.urgent}</span>
              <span className="text-sm text-red-400 mb-1">needs attention</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Overdue</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl text-amber-600">{stats.overdue}</span>
              <span className="text-sm text-amber-400 mb-1">past due</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Status Breakdown
            </h4>
            <div className="space-y-4">
              {STATUSES.map(status => {
                const count = filteredTasks.filter(t => t.status === status.id).length
                const percent = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={status.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 uppercase tracking-wider">{status.label}</span>
                      <span className="text-gray-900">{count}</span>
                    </div>
                    <div className="h-2.5 bg-gray-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          status.id === 'Completed' ? 'bg-green-500' :
                          status.id === 'Review' ? 'bg-purple-500' :
                          status.id === 'On Hold' ? 'bg-amber-500' :
                          status.id === 'In Progress' ? 'bg-orange-500' :
                          'bg-blue-500'
                        }`} 
                        style={{ width: `${percent}%` }} 
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Priority Distribution
            </h4>
            <div className="flex h-48 items-end justify-around gap-2 px-4">
              {['normal', 'high', 'urgent'].map(p => {
                const count = filteredTasks.filter(t => t.priority === p).length
                const height = stats.total > 0 ? (count / stats.total) * 100 : 5
                return (
                  <div key={p} className="flex-1 flex flex-col items-center gap-2 max-w-[60px]">
                    <span className="text-[10px] text-gray-500 uppercase">{count}</span>
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-1000 ${
                        p === 'urgent' ? 'bg-red-500 shadow-lg shadow-red-100' :
                        p === 'high' ? 'bg-amber-500 shadow-lg shadow-amber-100' :
                        'bg-indigo-500 shadow-lg shadow-indigo-100'
                      }`}
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">{p}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 font-sans">
      {/* Header - Fixed structure with proper alignment */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        {/* Row 1: Title and Add Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your tasks and ideas</p>
          </div>
          <button 
            onClick={() => {
              if (activeTab === 'reminders') {
                // Handle reminders
              } else {
                setNewTask({ ...newTask, is_personal: activeTab === 'personal', category: activeTab === 'idea' ? 'idea' : 'task' })
                setShowAddModal(true)
              }
            }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
          >
            <Plus size={16} />
            <span>{activeTab === 'reminders' ? 'New Announcement' : 'New Task'}</span>
          </button>
        </div>

        {/* Row 2: Tabs and View Mode */}
        <div className="flex items-center justify-between gap-4">
          {/* Tabs - Left aligned */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-md whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                {React.cloneElement(tab.icon, { size: 14 })}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* View Mode Buttons - Right aligned */}
          {activeTab !== 'reminders' && activeTab !== 'idea' && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-md ${
                  viewMode === 'board' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Layout size={14} />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-md ${
                  viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Table size={14} />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all rounded-md ${
                  viewMode === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <BarChart2 size={14} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'team' && (
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-gray-400 shrink-0" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">Filter:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setClientFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  clientFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                All ({tasks.filter(t => !t.is_personal && t.category === 'task').length})
              </button>
              {CLIENT_TYPES.map(type => {
                const count = tasks.filter(t => 
                  !t.is_personal && 
                  t.category === 'task' && 
                  t.client_type === type.id
                ).length
                return (
                  <button
                    key={type.id}
                    onClick={() => setClientFilter(type.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 border ${
                      clientFilter === type.id
                        ? `${type.bgColor} ${type.color} ${type.borderColor} shadow-sm`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                    <span className={`text-[10px] ${clientFilter === type.id ? type.color : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => setClientFilter('internal')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  clientFilter === 'internal'
                    ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-800 hover:text-gray-800'
                }`}
              >
                🏠 Internal ({tasks.filter(t => !t.is_personal && t.category === 'task' && !t.client_name && !t.client_type).length})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto p-4 bg-gray-50/30">
        {activeTab === 'reminders' ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {reminders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No announcements yet</h3>
                <p className="text-gray-500 max-w-xs mx-auto">
                  Announcements and reminders for the team will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reminders.map(reminder => (
                  <div 
                    key={reminder.id}
                    className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      reminder.type === 'general' ? 'bg-indigo-500' : 
                      reminder.type === 'targeted' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            reminder.type === 'general' ? 'bg-indigo-50 text-indigo-600' : 
                            reminder.type === 'targeted' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {reminder.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {reminder.created_at ? formatDistanceToNow(new Date(reminder.created_at), { addSuffix: true }) : 'just now'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">{reminder.title}</h4>
                        <p className="text-gray-600 text-sm whitespace-pre-wrap line-clamp-2">{reminder.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'idea' ? (
          renderIdeaTabView()
        ) : viewMode === 'board' ? (
          renderBoardView()
        ) : viewMode === 'table' ? (
          renderTableView()
        ) : (
          renderDashboardView()
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                {activeTab === 'idea' ? 'New Idea' : 'New Task'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {activeTab === 'idea' ? 'Idea Title' : 'Task Title'}
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder={activeTab === 'idea' ? "What's your idea?" : "What needs to be done?"}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  rows={3}
                  placeholder="Add more details..."
                />
              </div>

              {activeTab !== 'idea' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                      <select
                        value={newTask.status}
                        onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                      <input
                        type="date"
                        value={newTask.due_date || ''}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Type</label>
                      <select
                        value={newTask.client_type || ''}
                        onChange={(e) => setNewTask({ ...newTask, client_type: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="">Internal</option>
                        {CLIENT_TYPES.map(ct => <option key={ct.id} value={ct.id}>{ct.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {newTask.client_type && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name</label>
                      <input
                        type="text"
                        value={newTask.client_name}
                        onChange={(e) => setNewTask({ ...newTask, client_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="Enter client name"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Create {activeTab === 'idea' ? 'Idea' : 'Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
