import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Clock,
  MapPin,
  Navigation,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  ShieldCheck,
  Download,
  RefreshCw,
  Smartphone,
  Building2,
  Home,
  Car,
  X,
  Send,
  Sliders,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Search,
} from 'lucide-react';

interface OfficeGeofence {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  shift_start: string;
  shift_end: string;
  grace_period_minutes: number;
  half_day_hours?: number;
  full_day_hours?: number;
  punch_out_geofence_required?: number;
}

interface AttendanceRecord {
  id: number;
  user_id: string;
  attendance_date: string;
  work_mode: 'office' | 'wfh' | 'on_duty';
  shift_start?: string;
  shift_end?: string;
  check_in_time: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_distance_meters?: number;
  check_in_status?: string;
  check_in_local?: string;
  check_out_time?: string;
  check_out_lat?: number;
  check_out_lng?: number;
  check_out_distance_meters?: number;
  check_out_local?: string;
  total_work_minutes?: number;
  final_status: string;
  is_regularized?: number;
  notes?: string;
}

interface MonthlyStats {
  total_punched_days: number;
  present_count: number;
  late_count: number;
  half_day_count: number;
  wfh_count: number;
  on_duty_count: number;
  regularized_count: number;
  total_work_hours: number;
  avg_daily_hours: number;
}

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user && ['super_admin', 'support_manager'].includes(user.role);

  // Core State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'admin-roster' | 'admin-regularize' | 'admin-settings'>('punch');
  const [office, setOffice] = useState<OfficeGeofence>({
    name: 'Assurance Media HQ',
    latitude: 19.08250795,
    longitude: 72.89673053,
    radius_meters: 100,
    shift_start: '10:00:00',
    shift_end: '19:00:00',
    grace_period_minutes: 15,
  });

  // GPS & Geofence State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);

  // Punch State
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workMode, setWorkMode] = useState<'office' | 'wfh' | 'on_duty'>('office');
  const [punchNotes, setPunchNotes] = useState('');
  const [punching, setPunching] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);

  // Calendar & History State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [monthStats, setMonthStats] = useState<MonthlyStats | null>(null);
  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceRecord | null>(null);

  // Regularization Modal State
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    attendance_date: new Date().toISOString().split('T')[0],
    requested_check_in: '10:00:00',
    requested_check_out: '19:00:00',
    work_mode: 'office',
    reason: '',
  });
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Admin Roster State
  const [adminDate, setAdminDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adminRoster, setAdminRoster] = useState<any[]>([]);
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'ALL' | 'PRESENT' | 'WFH_OD' | 'NOT_PUNCHED'>('ALL');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Admin Regularizations Queue State
  const [pendingRegs, setPendingRegs] = useState<any[]>([]);
  const [processingRegId, setProcessingRegId] = useState<number | null>(null);

  // Admin Office Settings Form
  const [officeForm, setOfficeForm] = useState<OfficeGeofence>(office);
  const [savingOffice, setSavingOffice] = useState(false);
  const [officeSaved, setOfficeSaved] = useState(false);

  // Live Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Elapsed Time Counter
  useEffect(() => {
    let timer: any = null;
    if (todayRecord && !todayRecord.check_out_time) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [todayRecord]);

  // Haversine client-side distance helper
  const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Acquire GPS Location
  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser/device.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsLocation({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setGpsLoading(false);

        if (office) {
          const dist = calculateHaversine(latitude, longitude, office.latitude, office.longitude);
          setDistanceToOffice(dist);
        }
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Unable to fetch GPS position.';
        if (err.code === 1) msg = 'Location permission denied. Please allow GPS access in browser settings.';
        if (err.code === 2) msg = 'GPS position unavailable. Please ensure location/GPS is turned on.';
        if (err.code === 3) msg = 'GPS acquisition timed out. Please retry.';
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      }
    );
  };

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/attendance/status');
      if (res.success) {
        if (res.office) {
          setOffice(res.office);
          setOfficeForm(res.office);
        }
        if (res.record) {
          setTodayRecord(res.record);
          setWorkMode(res.record.work_mode || 'office');
          setElapsedSeconds(res.elapsed_seconds || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load attendance status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Monthly Calendar History
  const loadMonthHistory = async (month: string) => {
    try {
      const res: any = await api.get(`/attendance/history?month=${month}`);
      if (res.success) {
        setMonthRecords(res.records || []);
        setMonthStats(res.stats || null);
      }
    } catch (err) {
      console.error('Failed to load month attendance history:', err);
    }
  };

  // Load Admin Roster
  const loadAdminRoster = async (date: string) => {
    try {
      setLoadingRoster(true);
      const res: any = await api.get(`/admin/attendance/roster?date=${date}`);
      if (res.success) {
        setAdminRoster(res.data || []);
        setAdminSummary(res.summary || null);
      }
    } catch (err) {
      console.error('Failed to load admin roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Load Admin Regularizations Queue
  const loadAdminRegs = async () => {
    try {
      const res: any = await api.get('/admin/attendance/regularizations');
      if (res.success) {
        setPendingRegs(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load regularizations:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    requestGps();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadMonthHistory(selectedMonth);
    } else if (activeTab === 'admin-roster' && isAdmin) {
      loadAdminRoster(adminDate);
    } else if (activeTab === 'admin-regularize' && isAdmin) {
      loadAdminRegs();
    }
  }, [activeTab, selectedMonth, adminDate]);

  // Handle Punch In
  const handlePunchIn = async () => {
    setPunchError(null);
    setPunchSuccess(null);

    if (workMode === 'office') {
      if (!gpsLocation) {
        setPunchError('GPS location is required for Office Check-In. Please tap "Refresh Location" below.');
        return;
      }
      if (distanceToOffice !== null && distanceToOffice > office.radius_meters) {
        setPunchError(
          `You are ${distanceToOffice}m away from ${office.name}. Office check-in requires being within ${office.radius_meters}m. Please move closer or switch to "Work From Home" mode.`
        );
        return;
      }
    }

    try {
      setPunching(true);
      const payload: any = {
        work_mode: workMode,
        notes: punchNotes,
      };
      if (gpsLocation) {
        payload.latitude = gpsLocation.lat;
        payload.longitude = gpsLocation.lng;
        payload.accuracy = gpsLocation.accuracy;
      }

      const res: any = await api.post('/attendance/check-in', payload);
      if (res.success) {
        setTodayRecord(res.data);
        setElapsedSeconds(0);
        setPunchSuccess(res.message || 'Punched in successfully!');
        setPunchNotes('');
      }
    } catch (err: any) {
      setPunchError(err.message || 'Failed to punch in. Please retry.');
    } finally {
      setPunching(false);
    }
  };

  // Handle Punch Out
  const handlePunchOut = async () => {
    if (!window.confirm('Are you sure you want to Punch Out for today?')) {
      return;
    }
    setPunchError(null);
    setPunchSuccess(null);

    try {
      setPunching(true);
      const payload: any = {
        notes: punchNotes,
      };
      if (gpsLocation) {
        payload.latitude = gpsLocation.lat;
        payload.longitude = gpsLocation.lng;
        payload.accuracy = gpsLocation.accuracy;
      }

      const res: any = await api.post('/attendance/check-out', payload);
      if (res.success) {
        setTodayRecord(res.data);
        setPunchSuccess(res.message || 'Punched out successfully!');
        setPunchNotes('');
      }
    } catch (err: any) {
      setPunchError(err.message || 'Failed to punch out. Please retry.');
    } finally {
      setPunching(false);
    }
  };

  // Submit Regularization
  const handleRegularizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.reason.trim()) {
      alert('Please specify a valid reason for regularization');
      return;
    }

    try {
      setSubmittingReg(true);
      const res: any = await api.post('/attendance/regularize', regForm);
      if (res.success) {
        setRegSuccess(true);
        setTimeout(() => {
          setShowRegModal(false);
          setRegSuccess(false);
          setRegForm({
            attendance_date: new Date().toISOString().split('T')[0],
            requested_check_in: '10:00:00',
            requested_check_out: '19:00:00',
            work_mode: 'office',
            reason: '',
          });
          if (activeTab === 'calendar') {
            loadMonthHistory(selectedMonth);
          }
        }, 1200);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit regularization');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Admin Review Regularization
  const handleReviewReg = async (id: number, action: 'approve' | 'reject') => {
    try {
      setProcessingRegId(id);
      const res: any = await api.post(`/admin/attendance/regularization/${id}/review`, { action });
      if (res.success) {
        setPendingRegs((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : r))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setProcessingRegId(null);
    }
  };

  // Save Office Geofence Config
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingOffice(true);
      const res: any = await api.post('/admin/attendance/geofence', officeForm);
      if (res.success) {
        setOffice(res.data);
        setOfficeSaved(true);
        setTimeout(() => setOfficeSaved(false), 2500);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update office geofence');
    } finally {
      setSavingOffice(false);
    }
  };

  // Helper formatting seconds
  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Format 12-hour time
  const format12Hour = (dateObj: Date) => {
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const isInsideFence = distanceToOffice !== null && distanceToOffice <= office.radius_meters;

  // Filtered roster
  const filteredRoster = adminRoster.filter((member) => {
    const matchesSearch =
      member.user_name.toLowerCase().includes(adminSearch.toLowerCase()) ||
      member.user_email.toLowerCase().includes(adminSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (adminFilter === 'PRESENT') return member.status === 'PRESENT' || member.status === 'LATE';
    if (adminFilter === 'WFH_OD') return member.work_mode === 'wfh' || member.work_mode === 'on_duty';
    if (adminFilter === 'NOT_PUNCHED') return member.status === 'NOT_PUNCHED';
    return true;
  });

  return (
    <div className="space-y-6 pb-20 sm:pb-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Darwinbox-Grade Engine
              </span>
              <span className="text-xs font-semibold text-slate-400">
                HQ: {office.name} ({office.radius_meters}m fence)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Attendance & Geofencing Command Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Real-time GPS proximity validation, biometric-grade shift tracking, and instant Google Sheets integration.
            </p>
          </div>

          {/* Real-time Clock Badge */}
          <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/15 flex items-center gap-4 self-start md:self-auto">
            <div className="p-2.5 bg-blue-600/40 rounded-lg text-blue-200">
              <Clock size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white">
                {format12Hour(currentTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Shift Details Banner */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">Shift Schedule:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 font-mono text-blue-300">
              {office.shift_start} - {office.shift_end} (Grace: {office.grace_period_minutes}m)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={requestGps}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-medium transition-colors text-xs border border-white/10"
            >
              <RefreshCw size={13} className={gpsLoading ? 'animate-spin' : ''} />
              <span>{gpsLoading ? 'Acquiring GPS...' : 'Refresh Location'}</span>
            </button>
            <button
              onClick={() => setShowRegModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-xs shadow-md shadow-indigo-600/30"
            >
              <Clock size={13} />
              <span>Request Regularization</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('punch')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'punch'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Smartphone size={16} />
          <span>Punch In / Out</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'calendar'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarIcon size={16} />
          <span>My Monthly Log</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('admin-roster')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === 'admin-roster'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users size={16} />
              <span>Today's Live Roster</span>
            </button>

            <button
              onClick={() => setActiveTab('admin-regularize')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap relative ${
                activeTab === 'admin-regularize'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck size={16} />
              <span>Regularization Requests</span>
              {pendingRegs.filter((r) => r.status === 'PENDING').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-2 right-2" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('admin-settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === 'admin-settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders size={16} />
              <span>Geofence & Schedule</span>
            </button>
          </>
        )}
      </div>

      {/* =========================================================================
          TAB 1: DARWINBOX PUNCH CLOCK & GEOFENCE RADAR
      ========================================================================== */}
      {activeTab === 'punch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Darwinbox Punch Card */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Today's Attendance Status</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Status Pill */}
                <div>
                  {!todayRecord ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Not Punched In
                    </span>
                  ) : todayRecord.check_out_time ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Completed ({Math.floor((todayRecord.total_work_minutes || 0) / 60)}h {(todayRecord.total_work_minutes || 0) % 60}m)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active ({todayRecord.work_mode?.toUpperCase()})
                    </span>
                  )}
                </div>
              </div>

              {/* Work Mode Selector (Disabled if already punched in) */}
              <div className="my-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Work Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={!!todayRecord}
                    onClick={() => setWorkMode('office')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      workMode === 'office'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-700 font-bold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Building2 size={20} className={workMode === 'office' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-xs mt-1.5 font-semibold">In-Office</span>
                    <span className="text-[10px] text-slate-400">HQ Geofenced</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!todayRecord}
                    onClick={() => setWorkMode('wfh')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      workMode === 'wfh'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-700 font-bold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Home size={20} className={workMode === 'wfh' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-xs mt-1.5 font-semibold">Work From Home</span>
                    <span className="text-[10px] text-slate-400">Remote Shift</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!todayRecord}
                    onClick={() => setWorkMode('on_duty')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      workMode === 'on_duty'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-700 font-bold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Car size={20} className={workMode === 'on_duty' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-xs mt-1.5 font-semibold">On-Duty</span>
                    <span className="text-[10px] text-slate-400">Client / Field</span>
                  </button>
                </div>
              </div>

              {/* Big Darwinbox Action Punch Clock */}
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 my-4 text-center">
                {todayRecord && !todayRecord.check_out_time ? (
                  <>
                    <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Elapsed Working Time
                    </div>
                    <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 my-2">
                      {formatTimer(elapsedSeconds)}
                    </div>
                    <div className="text-xs text-slate-500 mb-6">
                      Checked in at {todayRecord.check_in_local || todayRecord.check_in_time} ({todayRecord.work_mode?.toUpperCase()})
                    </div>

                    <button
                      type="button"
                      disabled={punching}
                      onClick={handlePunchOut}
                      className="w-full sm:w-72 py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-base shadow-lg shadow-rose-600/30 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Clock size={20} />
                      <span>{punching ? 'Recording Punch Out...' : 'Punch Out Now'}</span>
                    </button>
                  </>
                ) : todayRecord && todayRecord.check_out_time ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Today's Shift Completed</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      In: <span className="font-semibold text-slate-700">{todayRecord.check_in_local || todayRecord.check_in_time}</span> • Out:{' '}
                      <span className="font-semibold text-slate-700">{todayRecord.check_out_local || todayRecord.check_out_time}</span>
                    </p>
                    <div className="mt-4 px-4 py-2 rounded-xl bg-purple-100 text-purple-800 text-sm font-extrabold font-mono">
                      Total Duration: {Math.floor((todayRecord.total_work_minutes || 0) / 60)} hrs {(todayRecord.total_work_minutes || 0) % 60} mins
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Shift: {office.shift_start} - {office.shift_end}
                    </div>

                    <button
                      type="button"
                      disabled={punching || (workMode === 'office' && !isInsideFence && distanceToOffice !== null)}
                      onClick={handlePunchIn}
                      className={`w-full sm:w-72 py-4 px-6 rounded-2xl text-white font-extrabold text-base shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        workMode === 'office' && !isInsideFence && distanceToOffice !== null
                          ? 'bg-slate-400 shadow-none'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30'
                      }`}
                    >
                      <Clock size={20} />
                      <span>{punching ? 'Verifying & Punching...' : 'Punch In Now'}</span>
                    </button>

                    {workMode === 'office' && distanceToOffice !== null && !isInsideFence && (
                      <p className="text-xs text-rose-600 font-semibold mt-3">
                        ⚠️ Cannot punch in: You are {distanceToOffice}m away (must be within {office.radius_meters}m). Switch to WFH mode if remote.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Notes Input */}
              {!todayRecord?.check_out_time && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Punch Remarks / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={punchNotes}
                    onChange={(e) => setPunchNotes(e.target.value)}
                    placeholder={
                      workMode === 'wfh'
                        ? 'e.g. Working remotely today on client sprint'
                        : workMode === 'on_duty'
                        ? 'e.g. Client visit at Bandra'
                        : 'e.g. Morning check-in'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Alerts */}
              {punchError && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{punchError}</span>
                </div>
              )}

              {punchSuccess && (
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{punchSuccess}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Geofence Radar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">GPS Geofence Radar</h3>
                    <p className="text-[11px] text-slate-500">Live Haversine Proximity Check</p>
                  </div>
                </div>

                <button
                  onClick={requestGps}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Recalculate location"
                >
                  <RefreshCw size={15} className={gpsLoading ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>

              {/* Animated Radar Visualizer */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  {/* Outer ripple rings */}
                  <div
                    className={`absolute inset-0 rounded-full border-2 animate-ping opacity-25 ${
                      workMode === 'office'
                        ? isInsideFence
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-rose-500 bg-rose-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  />
                  <div
                    className={`absolute inset-4 rounded-full border-2 ${
                      workMode === 'office'
                        ? isInsideFence
                          ? 'border-emerald-400/50'
                          : 'border-rose-400/50'
                        : 'border-blue-400/50'
                    }`}
                  />
                  <div
                    className={`absolute inset-8 rounded-full border ${
                      workMode === 'office'
                        ? isInsideFence
                          ? 'border-emerald-300'
                          : 'border-rose-300'
                        : 'border-blue-300'
                    }`}
                  />

                  {/* Center Dot with Icon */}
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg z-10 ${
                      workMode === 'office'
                        ? isInsideFence
                          ? 'bg-emerald-600 shadow-emerald-500/30'
                          : 'bg-rose-600 shadow-rose-500/30'
                        : 'bg-blue-600 shadow-blue-500/30'
                    }`}
                  >
                    <Navigation size={22} className="transform -rotate-45" />
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-4 text-center">
                  {gpsLoading ? (
                    <div className="text-xs font-semibold text-slate-500 animate-pulse">
                      Acquiring device GPS satellites...
                    </div>
                  ) : distanceToOffice !== null ? (
                    <div>
                      <div
                        className={`text-sm font-black flex items-center justify-center gap-1.5 ${
                          workMode === 'office'
                            ? isInsideFence
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {isInsideFence ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <AlertTriangle size={16} />
                        )}
                        <span>
                          {isInsideFence
                            ? `Inside Office Geofence (${distanceToOffice}m away)`
                            : `Outside Geofence (${distanceToOffice}m away)`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Allowed perimeter: within {office.radius_meters}m of {office.name}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      GPS coordinates unavailable. Tap "Refresh Location" above.
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates Info Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400 font-medium">Your Position:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : 'Detecting...'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400 font-medium">Office Target:</span>
                  <span className="font-mono text-slate-700">
                    {office.latitude.toFixed(6)}, {office.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400 font-medium">GPS Accuracy:</span>
                  <span className="font-mono text-slate-700">
                    {gpsLocation ? `±${gpsLocation.accuracy} meters` : 'N/A'}
                  </span>
                </div>
              </div>

              {gpsError && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{gpsError}</span>
                </div>
              )}
            </div>

            {/* Google Sheets Sync Notification Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200/80">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <FileSpreadsheet size={16} />
                </div>
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Real-Time Google Sheet Sync
                </h4>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Every punch-in, punch-out, and regularization instantly streams to your company's Google Sheet under the{' '}
                <strong className="font-bold">"Attendance Log"</strong> tab with full GPS audit stamps.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DARWINBOX MONTHLY ATTENDANCE CALENDAR & SUMMARY STATS
      ========================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Month Selector Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 font-medium">
                Viewing Monthly Breakdown for {user?.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/admin/attendance/export?month=${selectedMonth}`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Download size={14} />
                <span>Download Report</span>
              </a>
              <button
                onClick={() => setShowRegModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-md shadow-blue-500/20"
              >
                <Clock size={14} />
                <span>Apply Regularization</span>
              </button>
            </div>
          </div>

          {/* Darwinbox Stats Metric Cards */}
          {monthStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Days Punched</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{monthStats.total_punched_days}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Recorded days</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present (On-Time)</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{monthStats.present_count}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Full days</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Late Marks</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{monthStats.late_count}</div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">&gt; 15 min grace</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Half Days</div>
                <div className="text-2xl font-black text-purple-700 mt-1">{monthStats.half_day_count}</div>
                <div className="text-[10px] text-purple-600 font-semibold mt-0.5">&lt; 4 hours</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">WFH / OD</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {monthStats.wfh_count + monthStats.on_duty_count}
                </div>
                <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Remote / Field</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Hours</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{monthStats.total_work_hours}h</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Avg: {monthStats.avg_daily_hours}h/day</div>
              </div>
            </div>
          )}

          {/* Monthly Attendance Table & Detailed List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Daily Punch Logs ({monthRecords.length} Entries)</h3>
              <span className="text-xs text-slate-500">Tap any row to view location coordinates & audit details</span>
            </div>

            {monthRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CalendarIcon size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No attendance records found for {selectedMonth}</p>
                <p className="text-xs mt-1">Punches made on mobile or desktop will populate here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Work Mode</th>
                      <th className="py-3 px-4">Check-In</th>
                      <th className="py-3 px-4">Check-Out</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Distance</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthRecords.map((rec) => {
                      const totalHours = rec.total_work_minutes ? Math.floor(rec.total_work_minutes / 60) : 0;
                      const totalMins = rec.total_work_minutes ? rec.total_work_minutes % 60 : 0;
                      const status = rec.final_status?.toUpperCase() || 'PRESENT';

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedDayRecord(rec)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {rec.attendance_date}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded font-semibold text-[11px] uppercase bg-slate-100 text-slate-700">
                              {rec.work_mode || 'OFFICE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {rec.total_work_minutes ? `${totalHours}h ${totalMins}m` : 'In Progress'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                status === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : status === 'LATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : status === 'HALF_DAY'
                                  ? 'bg-purple-100 text-purple-800'
                                  : status === 'WFH'
                                  ? 'bg-blue-100 text-blue-800'
                                  : status === 'ON_DUTY'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {status}
                            </span>
                            {rec.is_regularized === 1 && (
                              <span className="ml-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">
                                REG
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {rec.check_in_distance_meters !== null && rec.check_in_distance_meters !== undefined
                              ? `${Math.round(rec.check_in_distance_meters)}m`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRegForm({
                                  attendance_date: rec.attendance_date,
                                  requested_check_in: '10:00:00',
                                  requested_check_out: '19:00:00',
                                  work_mode: rec.work_mode || 'office',
                                  reason: '',
                                });
                                setShowRegModal(true);
                              }}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                            >
                              Regularize
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ADMIN LIVE AGENCY ROSTER (SUPER ADMIN / SUPPORT MANAGER)
      ========================================================================== */}
      {activeTab === 'admin-roster' && isAdmin && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={adminDate}
                onChange={(e) => setAdminDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search agency team member..."
                  className="pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none w-48 sm:w-60"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  onClick={() => setAdminFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${adminFilter === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setAdminFilter('PRESENT')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${adminFilter === 'PRESENT' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}
                >
                  Present
                </button>
                <button
                  onClick={() => setAdminFilter('WFH_OD')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${adminFilter === 'WFH_OD' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
                >
                  Remote/Field
                </button>
                <button
                  onClick={() => setAdminFilter('NOT_PUNCHED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${adminFilter === 'NOT_PUNCHED' ? 'bg-white shadow text-rose-700' : 'text-slate-500'}`}
                >
                  Not In
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/admin/attendance/export?date=${adminDate}`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </a>
              <button
                onClick={() => loadAdminRoster(adminDate)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Refresh Roster"
              >
                <RefreshCw size={15} className={loadingRoster ? 'animate-spin text-blue-600' : ''} />
              </button>
            </div>
          </div>

          {/* Roster Overview Summary Cards */}
          {adminSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Team</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{adminSummary.total_staff}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Office In</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{adminSummary.present_office}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">WFH / OD</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {adminSummary.wfh + adminSummary.on_duty}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Late Arrivals</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{adminSummary.late}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Not Punched</div>
                <div className="text-2xl font-black text-rose-700 mt-1">{adminSummary.not_punched}</div>
              </div>
            </div>
          )}

          {/* Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Live Attendance Roster for {adminDate} ({filteredRoster.length} Members)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">In Time</th>
                    <th className="py-3 px-4">Out Time</th>
                    <th className="py-3 px-4">Geofence Distance</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((m) => {
                    const isPunched = m.attendance_id !== null;
                    const st = m.status?.toUpperCase();

                    return (
                      <tr key={m.user_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{m.user_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.user_email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium capitalize">
                          {m.user_role?.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              !isPunched
                                ? 'bg-slate-100 text-slate-500'
                                : st === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : st === 'LATE'
                                ? 'bg-amber-100 text-amber-800'
                                : st === 'HALF_DAY'
                                ? 'bg-purple-100 text-purple-800'
                                : st === 'WFH'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-cyan-100 text-cyan-800'
                            }`}
                          >
                            {!isPunched ? 'NOT PUNCHED' : st}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 uppercase text-[11px]">
                          {m.work_mode || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {m.check_in_time ? new Date(m.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {m.check_out_time ? new Date(m.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : isPunched ? 'Active' : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {m.check_in_distance_meters !== null && m.check_in_distance_meters !== undefined
                            ? `${Math.round(m.check_in_distance_meters)}m`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {m.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ADMIN REGULARIZATION QUEUE (SUPER ADMIN / SUPPORT MANAGER)
      ========================================================================== */}
      {activeTab === 'admin-regularize' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Regularization Requests</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve missing punches submitted by team members.
              </p>
            </div>
            <button
              onClick={loadAdminRegs}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {pendingRegs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShieldCheck size={36} className="mx-auto mb-2 opacity-40 text-emerald-600" />
              <p className="text-sm font-semibold">No regularization requests</p>
              <p className="text-xs mt-1">Requests submitted by employees will appear here for 1-click review.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRegs.map((reg) => (
                <div key={reg.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{reg.user_name}</span>
                      <span className="text-xs text-slate-400 font-mono">({reg.user_email})</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          reg.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : reg.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {reg.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                      <span>Date: <strong className="text-slate-800">{reg.attendance_date}</strong></span>
                      <span>•</span>
                      <span>Requested In: <strong className="text-slate-800 font-mono">{reg.requested_check_in}</strong></span>
                      <span>•</span>
                      <span>Requested Out: <strong className="text-slate-800 font-mono">{reg.requested_check_out}</strong></span>
                      <span>•</span>
                      <span>Mode: <strong className="text-slate-800 uppercase">{reg.work_mode}</strong></span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      <strong>Reason:</strong> {reg.reason}
                    </p>
                  </div>

                  {reg.status === 'PENDING' && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        disabled={processingRegId === reg.id}
                        onClick={() => handleReviewReg(reg.id, 'approve')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>Approve</span>
                      </button>
                      <button
                        disabled={processingRegId === reg.id}
                        onClick={() => handleReviewReg(reg.id, 'reject')}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: ADMIN OFFICE GEOFENCE & SHIFT SCHEDULE CONFIG
      ========================================================================== */}
      {activeTab === 'admin-settings' && isAdmin && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Office Geofence & Shift Configuration</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set company headquarters GPS center, allowed perimeter radius, and shift timings.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Sliders size={20} />
            </div>
          </div>

          <form onSubmit={handleSaveOffice} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Office Location Name
              </label>
              <input
                type="text"
                required
                value={officeForm.name}
                onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Center Latitude
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  required
                  value={officeForm.latitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, latitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Center Longitude
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  required
                  value={officeForm.longitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, longitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Button: Set to current location */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (gpsLocation) {
                    setOfficeForm({
                      ...officeForm,
                      latitude: gpsLocation.lat,
                      longitude: gpsLocation.lng,
                    });
                  } else {
                    requestGps();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
              >
                <MapPin size={13} />
                <span>Use My Current Device Coordinates</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Allowed Geofence Radius: <span className="text-blue-600 font-mono">{officeForm.radius_meters} meters</span>
                </label>
              </div>
              <input
                type="range"
                min="30"
                max="2000"
                step="10"
                value={officeForm.radius_meters}
                onChange={(e) => setOfficeForm({ ...officeForm, radius_meters: parseInt(e.target.value) || 100 })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Tight (30m)</span>
                <span>Standard (100m)</span>
                <span>Campus / Wide (500m+)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Shift Start Time
                </label>
                <input
                  type="time"
                  required
                  value={officeForm.shift_start}
                  onChange={(e) => setOfficeForm({ ...officeForm, shift_start: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Shift End Time
                </label>
                <input
                  type="time"
                  required
                  value={officeForm.shift_end}
                  onChange={(e) => setOfficeForm({ ...officeForm, shift_end: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={officeForm.grace_period_minutes}
                  onChange={(e) => setOfficeForm({ ...officeForm, grace_period_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {officeSaved && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Geofence parameters and shift settings successfully updated!</span>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingOffice}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={16} />
                <span>{savingOffice ? 'Saving Parameters...' : 'Save Office Geofence'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: APPLY FOR ATTENDANCE REGULARIZATION
      ========================================================================== */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowRegModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Regularization</h3>
                <p className="text-xs text-slate-500">Missed a punch or were on official duty?</p>
              </div>
            </div>

            <form onSubmit={handleRegularizeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Attendance Date
                </label>
                <input
                  type="date"
                  required
                  value={regForm.attendance_date}
                  onChange={(e) => setRegForm({ ...regForm, attendance_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Requested In Time
                  </label>
                  <input
                    type="time"
                    required
                    value={regForm.requested_check_in}
                    onChange={(e) => setRegForm({ ...regForm, requested_check_in: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Requested Out Time
                  </label>
                  <input
                    type="time"
                    required
                    value={regForm.requested_check_out}
                    onChange={(e) => setRegForm({ ...regForm, requested_check_out: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Work Mode
                </label>
                <select
                  value={regForm.work_mode}
                  onChange={(e) => setRegForm({ ...regForm, work_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="office">In-Office (Assurance Media HQ)</option>
                  <option value="wfh">Work From Home (Remote)</option>
                  <option value="on_duty">On-Duty (Client / Field)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason for Regularization *
                </label>
                <textarea
                  required
                  rows={3}
                  value={regForm.reason}
                  onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                  placeholder="e.g. Forgot to punch out due to urgent client deadline..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {regSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>Request submitted for manager approval!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReg}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send size={14} />
                  <span>{submittingReg ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DAY PUNCH DETAILS MODAL
      ========================================================================== */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedDayRecord(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <CalendarIcon size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Punch Details: {selectedDayRecord.attendance_date}
                </h3>
                <span className="text-xs font-bold uppercase text-blue-600">
                  Mode: {selectedDayRecord.work_mode || 'OFFICE'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs divide-y divide-slate-100">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">Punch In Time:</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedDayRecord.check_in_time ? new Date(selectedDayRecord.check_in_time).toLocaleString() : '—'}
                </span>
              </div>

              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">Punch Out Time:</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedDayRecord.check_out_time ? new Date(selectedDayRecord.check_out_time).toLocaleString() : 'Active'}
                </span>
              </div>

              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">Total Duration:</span>
                <span className="font-bold text-purple-700">
                  {selectedDayRecord.total_work_minutes
                    ? `${Math.floor(selectedDayRecord.total_work_minutes / 60)} hrs ${selectedDayRecord.total_work_minutes % 60} mins`
                    : 'In Progress'}
                </span>
              </div>

              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">Geofence Distance:</span>
                <span className="font-mono text-slate-700">
                  {selectedDayRecord.check_in_distance_meters !== null && selectedDayRecord.check_in_distance_meters !== undefined
                    ? `${Math.round(selectedDayRecord.check_in_distance_meters)} meters`
                    : 'N/A'}
                </span>
              </div>

              <div className="pt-2 flex justify-between">
                <span className="text-slate-400">Final Verdict:</span>
                <span className="font-bold text-emerald-700 uppercase">
                  {selectedDayRecord.final_status}
                </span>
              </div>

              {selectedDayRecord.notes && (
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1">Notes:</span>
                  <p className="bg-slate-50 p-2 rounded-lg text-slate-700 font-medium">
                    {selectedDayRecord.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
