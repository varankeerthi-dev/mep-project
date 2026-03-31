import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../App'
import {
  getSites,
  getTodayAttendance,
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  updateAttendanceRemarks,
  type Site,
  type Attendance
} from '../supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MapPin, Mic, MicOff, LogIn, LogOut, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const EARTH_RADIUS_METERS = 6371000

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return EARTH_RADIUS_METERS * c
}

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  error: string | null
  loading: boolean
}

interface VoiceState {
  listening: boolean
  transcript: string
  error: string | null
}

export default function EmployeeCheckIn() {
  const { user, organisation } = useAuth()
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentDate, setCurrentDate] = useState('')
  
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  
  const [geolocation, setGeolocation] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false
  })
  
  const [distance, setDistance] = useState<number | null>(null)
  const [isWithinRange, setIsWithinRange] = useState(false)
  
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null)
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  
  const [remarks, setRemarks] = useState('')
  const [voice, setVoice] = useState<VoiceState>({
    listening: false,
    transcript: '',
    error: null
  })
  
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const recognitionSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }
    setCurrentDate(currentTime.toLocaleDateString('en-IN', options))
  }, [currentTime])

  const fetchSites = useCallback(async () => {
    if (!organisation?.id) return
    setLoading(true)
    try {
      const { data, error } = await getSites(organisation.id)
      if (error) throw error
      if (data && data.length > 0) {
        setSites(data)
        setSelectedSite(data[0])
      }
    } catch (err) {
      console.error('Error fetching sites:', err)
    } finally {
      setLoading(false)
    }
  }, [organisation?.id])

  const fetchTodayAttendance = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await getTodayAttendance(user.id)
      if (error) throw error
      if (data) {
        setTodayAttendance(data)
        setIsCheckedIn(data.status === 'checked_in')
        if (data.remarks) {
          setRemarks(data.remarks)
        }
      }
    } catch (err) {
      console.error('Error fetching attendance:', err)
    }
  }, [user?.id])

  useEffect(() => {
    fetchSites()
    fetchTodayAttendance()
  }, [fetchSites, fetchTodayAttendance])

  useEffect(() => {
    if (!selectedSite || !geolocation.latitude || !geolocation.longitude) {
      setDistance(null)
      setIsWithinRange(false)
      return
    }

    const dist = haversineDistance(
      geolocation.latitude,
      geolocation.longitude,
      selectedSite.latitude,
      selectedSite.longitude
    )
    setDistance(dist)
    setIsWithinRange(dist <= selectedSite.radius_meters)
  }, [selectedSite, geolocation.latitude, geolocation.longitude])

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocation(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser'
      }))
      return
    }

    setGeolocation(prev => ({ ...prev, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false
        })
      },
      (error) => {
        let message = 'Unable to retrieve your location'
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable location access.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable.'
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out.'
        }
        setGeolocation({
          latitude: null,
          longitude: null,
          error: message,
          loading: false
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, [])

  useEffect(() => {
    requestGeolocation()
  }, [requestGeolocation])

  const translateText = async (text: string): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`
      )
      const data = await response.json()
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText
      }
      return text
    } catch {
      console.warn('Translation failed, using original text')
      return text
    }
  }

  const startVoiceRecognition = useCallback(async () => {
    if (!recognitionSupported) {
      setVoice(prev => ({
        ...prev,
        error: 'Speech recognition is not supported in your browser'
      }))
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = 'en-IN'

    recognitionRef.current.onstart = () => {
      setVoice(prev => ({ ...prev, listening: true, error: null }))
    }

    recognitionRef.current.onresult = async (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        const translated = await translateText(finalTranscript.trim())
        setVoice(prev => ({
          ...prev,
          transcript: prev.transcript + translated + ' '
        }))
        setRemarks(prev => prev + translated + ' ')
      }
    }

    recognitionRef.current.onerror = (event) => {
      setVoice(prev => ({
        ...prev,
        error: `Speech recognition error: ${event.error}`,
        listening: false
      }))
    }

    recognitionRef.current.onend = () => {
      setVoice(prev => ({ ...prev, listening: false }))
    }

    recognitionRef.current.start()
  }, [recognitionSupported])

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setVoice(prev => ({ ...prev, listening: false }))
    }
  }, [])

  const handleCheckIn = async () => {
    if (!user?.id || !selectedSite || !geolocation.latitude || !geolocation.longitude) return
    
    setActionLoading(true)
    try {
      const { data, error } = await apiCheckIn(
        user.id,
        selectedSite.id,
        geolocation.latitude,
        geolocation.longitude,
        remarks || undefined
      )
      
      if (error) throw error
      
      setTodayAttendance(data)
      setIsCheckedIn(true)
    } catch (err) {
      console.error('Check-in error:', err)
      alert('Failed to check in. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!todayAttendance?.id || !geolocation.latitude || !geolocation.longitude) return
    
    setActionLoading(true)
    try {
      const { data, error } = await apiCheckOut(
        todayAttendance.id,
        geolocation.latitude,
        geolocation.longitude,
        remarks || undefined
      )
      
      if (error) throw error
      
      setTodayAttendance(data)
      setIsCheckedIn(false)
    } catch (err) {
      console.error('Check-out error:', err)
      alert('Failed to check out. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemarksChange = async (value: string) => {
    setRemarks(value)
    
    if (todayAttendance?.id && value !== todayAttendance.remarks) {
      try {
        await updateAttendanceRemarks(todayAttendance.id, value)
      } catch (err) {
        console.error('Failed to update remarks:', err)
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Employee Check-In</h1>
        <p className="text-slate-500">{currentDate}</p>
        <div className="flex items-center justify-center gap-2 text-3xl font-mono font-bold text-slate-800">
          <Clock className="w-6 h-6" />
          {formatTime(currentTime)}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Work Site
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Select Site
              </label>
              <select
                className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSite?.id || ''}
                onChange={(e) => {
                  const site = sites.find(s => s.id === e.target.value)
                  setSelectedSite(site || null)
                }}
                disabled={loading}
              >
                {sites.length === 0 && (
                  <option value="">No sites assigned</option>
                )}
                {sites.map(site => (
                  <option key={site.id} value={site.id}>
                    {site.site_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Site Radius
              </label>
              <div className="h-10 px-3 flex items-center border border-slate-300 rounded-lg bg-slate-50">
                {selectedSite ? `${selectedSite.radius_meters} meters` : '-'}
              </div>
            </div>
          </div>

          {selectedSite && (
            <div className="text-sm text-slate-600">
              Site coordinates: {selectedSite.latitude.toFixed(6)}, {selectedSite.longitude.toFixed(6)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Your Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {geolocation.loading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Getting your location...
            </div>
          )}

          {geolocation.error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800">{geolocation.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={requestGeolocation}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {geolocation.latitude && geolocation.longitude && !geolocation.loading && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Latitude:</span>
                  <span className="ml-2 font-mono">{geolocation.latitude.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Longitude:</span>
                  <span className="ml-2 font-mono">{geolocation.longitude.toFixed(6)}</span>
                </div>
              </div>

              {distance !== null && selectedSite && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  isWithinRange
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  {isWithinRange ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      isWithinRange ? 'text-green-800' : 'text-amber-800'
                    }`}>
                      {isWithinRange ? 'You are within the site radius!' : 'You are outside the site radius'}
                    </p>
                    <p className="text-sm">
                      Distance: <span className="font-mono">{Math.round(distance)} meters</span>
                      {' / '}
                      <span className="font-mono">{selectedSite.radius_meters} meters allowed</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Remarks
            {voice.listening && (
              <Badge className="bg-red-600 text-white animate-pulse">
                Recording...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              placeholder="Enter remarks about your visit (e.g., traffic delay, site conditions, etc.)"
              value={remarks}
              onChange={(e) => handleRemarksChange(e.target.value)}
              className="min-h-[120px] pr-12"
            />
            <Button
              size="icon"
              variant={voice.listening ? 'destructive' : 'outline'}
              className="absolute top-2 right-2 h-10 w-10"
              onClick={voice.listening ? stopVoiceRecognition : startVoiceRecognition}
              disabled={!recognitionSupported}
              title={recognitionSupported ? 'Voice input (auto-translates to English)' : 'Voice input not supported'}
            >
              {voice.listening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </div>

          {voice.error && (
            <p className="text-sm text-red-600">{voice.error}</p>
          )}

          {voice.transcript && (
            <p className="text-xs text-slate-500">
              Last captured: "{voice.transcript.trim()}"
            </p>
          )}

          <p className="text-xs text-slate-500">
            Tip: Click the microphone and speak in any language. Your words will be automatically translated to English.
          </p>
        </CardContent>
      </Card>

      {todayAttendance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Today's Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {todayAttendance.check_in_time && (
                <div>
                  <span className="text-slate-500">Checked In:</span>
                  <p className="font-medium">
                    {new Date(todayAttendance.check_in_time).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              {todayAttendance.check_out_time && (
                <div>
                  <span className="text-slate-500">Checked Out:</span>
                  <p className="font-medium">
                    {new Date(todayAttendance.check_out_time).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              <div>
                <span className="text-slate-500">Status:</span>
                <Badge
                  variant={todayAttendance.status === 'checked_out' ? 'default' : 'secondary'}
                  className="ml-2"
                >
                  {todayAttendance.status.replace('_', ' ')}
                </Badge>
              </div>
              {todayAttendance.site && (
                <div>
                  <span className="text-slate-500">Site:</span>
                  <p className="font-medium">{todayAttendance.site.site_name}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        {!isCheckedIn ? (
          <Button
            size="lg"
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={
              !isWithinRange ||
              !selectedSite ||
              !geolocation.latitude ||
              actionLoading ||
              geolocation.loading
            }
            onClick={handleCheckIn}
          >
            {actionLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5 mr-2" />
            )}
            Check In
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 bg-red-600 hover:bg-red-700"
            disabled={
              !geolocation.latitude ||
              actionLoading ||
              geolocation.loading
            }
            onClick={handleCheckOut}
          >
            {actionLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5 mr-2" />
            )}
            Check Out
          </Button>
        )}
      </div>

      {isCheckedIn && (
        <p className="text-center text-sm text-slate-500">
          Don't forget to check out when you leave the site!
        </p>
      )}
    </div>
  )
}
