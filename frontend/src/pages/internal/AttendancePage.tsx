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
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  UserCheck,
  Lock,
  Unlock,
  CheckSquare,
  List,
  Grid
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
  is_early_exit?: number;
  is_late?: number;
  notes?: string;
}

interface MonthlyStats {
  total_punched_days: number;
  present_count: number;
  late_count: number;
  early_exit_count?: number;
  half_day_count: number;
  wfh_count: number;
  on_duty_count: number;
  regularized_count: number;
  total_work_hours: number;
  avg_daily_hours: number;
}

interface CompanyHoliday {
  id: number;
  name: string;
  holiday_date: string;
  description?: string;
  created_by?: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  custom_role?: string;
  avatar_url?: string;
  can_manage_attendance?: number | boolean;
}

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user && ['super_admin', 'support_manager'].includes(user.role);
  const canManageAttendance = Boolean(isAdmin || user?.can_manage_attendance);
  const isSuperAdmin = user?.role === 'super_admin';

  // Core State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'punch' | 'calendar' | 'admin-roster' | 'admin-regularize' | 'admin-holidays' | 'admin-permissions' | 'admin-settings'
  >('punch');

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
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'table'>('grid');
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [monthStats, setMonthStats] = useState<MonthlyStats | null>(null);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDayHoliday, setSelectedDayHoliday] = useState<CompanyHoliday | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

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

  // Manual Punch Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in_time: '10:00:00',
    check_out_time: '19:00:00',
    work_mode: 'office',
    notes: 'HR Assigned Punch',
  });
  const [assigningPunch, setAssigningPunch] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Admin Roster State
  const [adminDate, setAdminDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adminRoster, setAdminRoster] = useState<any[]>([]);
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'ALL' | 'PRESENT' | 'WFH_OD' | 'NOT_PUNCHED'>('ALL');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Admin Regularizations Queue State
  const [adminRegs, setAdminRegs] = useState<any[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [reviewingRegId, setReviewingRegId] = useState<number | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');

  // Admin Office Geofence Form State
  const [officeForm, setOfficeForm] = useState<OfficeGeofence>(office);
  const [savingOffice, setSavingOffice] = useState(false);
  const [officeSaveMsg, setOfficeSaveMsg] = useState<string | null>(null);

  // Holidays Management State
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    holiday_date: '',
    description: '',
  });
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [holidaySuccess, setHolidaySuccess] = useState<string | null>(null);

  // Access Delegation State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Live Digital Clock (HH:MM:SS)
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

  // Load Monthly Calendar History & Holidays
  const loadMonthHistory = async (month: string) => {
    try {
      const res: any = await api.get(`/attendance/history?month=${month}`);
      if (res.success) {
        setMonthRecords(res.records || []);
        setMonthStats(res.stats || null);
        if (res.holidays) {
          setHolidays(res.holidays);
        }
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  // Load All Holidays
  const loadHolidays = async () => {
    try {
      const year = selectedMonth.split('-')[0];
      const res: any = await api.get(`/attendance/holidays?year=${year}`);
      if (res.success) {
        setHolidays(res.holidays || []);
      }
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  };

  // Load Staff List
  const loadStaffList = async () => {
    try {
      setLoadingStaff(true);
      const res: any = await api.get('/admin/attendance/permissions');
      if (res.success) {
        setStaffList(res.staff || []);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Load Admin Live Roster
  const loadAdminRoster = async (date: string, search = '') => {
    try {
      setLoadingRoster(true);
      const query = `?date=${date}` + (search ? `&search=${encodeURIComponent(search)}` : '');
      const res: any = await api.get(`/admin/attendance/roster${query}`);
      if (res.success) {
        setAdminRoster(res.data || []);
        setAdminSummary(res.summary || null);
      }
    } catch (err: any) {
      console.error('Failed to load admin roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Load Admin Regularizations
  const loadAdminRegularizations = async () => {
    try {
      setLoadingRegs(true);
      const res: any = await api.get('/admin/attendance/regularizations');
      if (res.success) {
        setAdminRegs(res.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load regularizations:', err);
    } finally {
      setLoadingRegs(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    requestGps();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadMonthHistory(selectedMonth);
    } else if (activeTab === 'admin-roster' && canManageAttendance) {
      loadAdminRoster(adminDate, adminSearch);
    } else if (activeTab === 'admin-regularize' && canManageAttendance) {
      loadAdminRegularizations();
    } else if (activeTab === 'admin-holidays') {
      loadHolidays();
    } else if (activeTab === 'admin-permissions' && isSuperAdmin) {
      loadStaffList();
    }
  }, [activeTab, selectedMonth, adminDate]);

  // Execute Punch In
  const handlePunchIn = async () => {
    setPunching(true);
    setPunchError(null);
    setPunchSuccess(null);

    try {
      const payload: any = {
        work_mode: workMode,
        notes: punchNotes,
      };

      if (workMode === 'office') {
        if (!gpsLocation) {
          throw new Error('GPS coordinates are required for In-Office punch. Please tap "Acquire GPS" above or select Work From Home.');
        }
        payload.latitude = gpsLocation.lat;
        payload.longitude = gpsLocation.lng;
        payload.accuracy = gpsLocation.accuracy;
      } else if (gpsLocation) {
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
        loadInitialData();
      }
    } catch (err: any) {
      setPunchError(err.message || 'Failed to punch in');
    } finally {
      setPunching(false);
    }
  };

  // Execute Punch Out
  const handlePunchOut = async () => {
    setPunching(true);
    setPunchError(null);
    setPunchSuccess(null);

    try {
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
        loadInitialData();
      }
    } catch (err: any) {
      setPunchError(err.message || 'Failed to punch out');
    } finally {
      setPunching(false);
    }
  };

  // Submit Regularization Request
  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReg(true);
    try {
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
        }, 1500);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit regularization');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Review Regularization (Approve / Reject)
  const handleReviewReg = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res: any = await api.post(`/admin/attendance/regularization/${id}/review`, {
        action,
        notes: reviewerNotes,
      });
      if (res.success) {
        setReviewingRegId(null);
        setReviewerNotes('');
        loadAdminRegularizations();
      }
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

  // Save Office Geofence Settings
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOffice(true);
    setOfficeSaveMsg(null);
    try {
      const res: any = await api.post('/admin/attendance/geofence', officeForm);
      if (res.success) {
        setOffice(res.data);
        setOfficeSaveMsg('Office geofence and shift schedules saved successfully!');
        setTimeout(() => setOfficeSaveMsg(null), 3500);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSavingOffice(false);
    }
  };

  // Manual Punch Assignment
  const handleAssignPunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningPunch(true);
    setAssignError(null);
    try {
      const res: any = await api.post('/admin/attendance/assign-punch', assignForm);
      if (res.success) {
        setAssignSuccess(true);
        setTimeout(() => {
          setShowAssignModal(false);
          setAssignSuccess(false);
          if (activeTab === 'admin-roster') loadAdminRoster(adminDate, adminSearch);
          if (activeTab === 'calendar') loadMonthHistory(selectedMonth);
        }, 1200);
      }
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign punch');
    } finally {
      setAssigningPunch(false);
    }
  };

  // Toggle User Attendance Permission
  const handleTogglePermission = async (userId: string, currentVal: boolean | number) => {
    setTogglingUser(userId);
    try {
      const newVal = currentVal ? 0 : 1;
      const res: any = await api.post('/admin/attendance/permissions', {
        user_id: userId,
        can_manage_attendance: newVal,
      });
      if (res.success) {
        setStaffList((prev) =>
          prev.map((s) => (s.id === userId ? { ...s, can_manage_attendance: newVal } : s))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update user permission');
    } finally {
      setTogglingUser(null);
    }
  };

  // Add Company Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHoliday(true);
    setHolidayError(null);
    setHolidaySuccess(null);
    try {
      const res: any = await api.post('/admin/attendance/holidays', newHoliday);
      if (res.success) {
        setHolidaySuccess(`Holiday "${newHoliday.name}" added successfully!`);
        setNewHoliday({ name: '', holiday_date: '', description: '' });
        loadHolidays();
        if (activeTab === 'calendar') loadMonthHistory(selectedMonth);
        setTimeout(() => setHolidaySuccess(null), 3000);
      }
    } catch (err: any) {
      setHolidayError(err.message || 'Failed to add holiday');
    } finally {
      setSavingHoliday(false);
    }
  };

  // Delete Company Holiday
  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Are you sure you want to remove this holiday?')) return;
    try {
      const res: any = await api.delete(`/admin/attendance/holidays/${id}`);
      if (res.success) {
        setHolidays((prev) => prev.filter((h) => h.id !== id));
        if (activeTab === 'calendar') loadMonthHistory(selectedMonth);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete holiday');
    }
  };

  // Format Elapsed Seconds as HH:MM:SS
  const formatStopwatch = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  // Check In-Fence Status
  const isInsideFence = distanceToOffice !== null && distanceToOffice <= office.radius_meters;

  // Calendar Helpers
  const [yearStr, monthStr] = selectedMonth.split('-');
  const calYear = parseInt(yearStr, 10);
  const calMonth = parseInt(monthStr, 10) - 1; // 0-indexed
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun, 6 = Sat

  // Calendar Navigation
  const changeMonth = (offset: number) => {
    const d = new Date(calYear, calMonth + offset, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ==========================================================================
          HEADER SECTION: BRAND LOGO + CURRENT TIME + USER PROFILE
      ========================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase mb-3 border border-blue-400/30">
              <Compass size={14} className="animate-spin" style={{ animationDuration: '8s' }} />
              Darwinbox Attendance & Geofencing Suite
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Workforce Attendance Hub</span>
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl font-normal">
              Self-service punch clock, spherical GPS geofencing, multi-user Google Sheets auto-sync, 
              and dynamic monthly audit calendar.
            </p>
          </div>

          {/* Real-Time Digital Clock */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/15 flex items-center gap-4 self-start lg:self-auto shadow-inner">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-400/30">
              <Clock size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Standard Indian Time (IST)</div>
              <div className="text-2xl sm:text-3xl font-mono font-black tracking-wider text-white">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-xs text-blue-300 font-medium">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-6 border-t border-slate-700/60 pt-4 scrollbar-none">
          <button
            onClick={() => setActiveTab('punch')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'punch'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clock size={16} />
            <span>Punch Clock</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <CalendarIcon size={16} />
            <span>Visual Calendar & Stats</span>
          </button>

          {canManageAttendance && (
            <>
              <button
                onClick={() => setActiveTab('admin-roster')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'admin-roster'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Users size={16} />
                <span>Live Staff Roster</span>
              </button>

              <button
                onClick={() => setActiveTab('admin-regularize')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'admin-regularize'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShieldCheck size={16} />
                <span>Regularizations</span>
              </button>

              <button
                onClick={() => setActiveTab('admin-holidays')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'admin-holidays'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sparkles size={16} />
                <span>Company Holidays</span>
              </button>

              <button
                onClick={() => setActiveTab('admin-settings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'admin-settings'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sliders size={16} />
                <span>Office Geofence</span>
              </button>
            </>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('admin-permissions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'admin-permissions'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
                  : 'text-amber-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Lock size={16} />
              <span>Access Delegation</span>
            </button>
          )}

          {canManageAttendance && (
            <button
              onClick={() => {
                setAssignForm({
                  user_id: user?.id || '',
                  attendance_date: new Date().toISOString().split('T')[0],
                  check_in_time: '10:00:00',
                  check_out_time: '19:00:00',
                  work_mode: 'office',
                  notes: 'HR Assigned Punch',
                });
                setShowAssignModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all flex items-center gap-1.5 shrink-0 ml-auto shadow-sm"
            >
              <Plus size={15} />
              <span>Assign / Adjust Punch</span>
            </button>
          )}
        </div>
      </div>

      {/* ==========================================================================
          TAB 1: DARWINBOX PUNCH CLOCK & RADAR ENGINE
      ========================================================================== */}
      {activeTab === 'punch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Dynamic Punch Card + Work Mode */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="text-blue-600" size={20} />
                    <span>Daily Shift Punch Terminal</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assigned Shift: <span className="font-semibold text-slate-700">{office.shift_start} - {office.shift_end}</span> (Grace period: {office.grace_period_minutes}m)
                  </p>
                </div>

                {/* Live Shift Stopwatch Counter */}
                {todayRecord && !todayRecord.check_out_time && (
                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-2 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Logged Shift Timer</div>
                      <div className="text-xl font-mono font-black text-emerald-700">{formatStopwatch(elapsedSeconds)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Work Mode Toggle (Office vs WFH vs On-Duty) */}
              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Work Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={Boolean(todayRecord)}
                    onClick={() => setWorkMode('office')}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      workMode === 'office'
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <Building2 size={20} className={workMode === 'office' ? 'text-blue-600' : 'text-slate-400'} />
                      {workMode === 'office' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs font-bold">In-Office</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">GPS Geofence Enforced</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(todayRecord)}
                    onClick={() => setWorkMode('wfh')}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      workMode === 'wfh'
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <Home size={20} className={workMode === 'wfh' ? 'text-blue-600' : 'text-slate-400'} />
                      {workMode === 'wfh' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs font-bold">Work From Home</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Remote Authorization</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(todayRecord)}
                    onClick={() => setWorkMode('on_duty')}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      workMode === 'on_duty'
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    } ${todayRecord ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <Car size={20} className={workMode === 'on_duty' ? 'text-blue-600' : 'text-slate-400'} />
                      {workMode === 'on_duty' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs font-bold">On-Duty / Field</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Client Location Visit</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Status Message Alerts */}
              {punchError && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Punch Error:</strong> {punchError}
                  </div>
                </div>
              )}

              {punchSuccess && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>{punchSuccess}</div>
                </div>
              )}

              {/* Action Notes Input */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Punch Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={punchNotes}
                  onChange={(e) => setPunchNotes(e.target.value)}
                  placeholder="e.g., Working on client onboarding, client site visit..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Major Action CTA: Punch In vs Punch Out */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                {!todayRecord ? (
                  <button
                    onClick={handlePunchIn}
                    disabled={punching || (workMode === 'office' && !isInsideFence)}
                    className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                      workMode === 'office' && !isInsideFence
                        ? 'bg-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25 active:scale-95'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    <span>{punching ? 'Validating Geofence...' : 'Punch In Now (Web / Mobile)'}</span>
                  </button>
                ) : !todayRecord.check_out_time ? (
                  <button
                    onClick={handlePunchOut}
                    disabled={punching}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Clock size={18} />
                    <span>{punching ? 'Recording Punch Out...' : 'Punch Out (End Daily Shift)'}</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-2 w-full">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>
                      Daily Shift Completed. Punched in at {todayRecord.check_in_local || todayRecord.check_in_time} and punched out at {todayRecord.check_out_local || todayRecord.check_out_time}.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={requestGps}
                  disabled={gpsLoading}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} className={gpsLoading ? 'animate-spin' : ''} />
                  <span>Refresh GPS Radar</span>
                </button>
              </div>
            </div>

            {/* Today Punch Summary Details */}
            {todayRecord && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>Today's Verified Punch Audit</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Punch In</span>
                    <span className="text-slate-800 font-mono font-bold text-sm">
                      {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      todayRecord.final_status === 'LATE' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {todayRecord.final_status === 'LATE' ? 'LATE' : 'ON TIME'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Punch Out</span>
                    <span className="text-slate-800 font-mono font-bold text-sm">
                      {todayRecord.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                    </span>
                    {todayRecord.is_early_exit ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        LEFT EARLY
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {todayRecord.check_out_time ? 'Completed' : 'Shift Active'}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Work Mode</span>
                    <span className="text-slate-800 font-bold uppercase text-sm">{todayRecord.work_mode}</span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {todayRecord.check_in_distance_meters !== null && todayRecord.check_in_distance_meters !== undefined
                        ? `${Math.round(todayRecord.check_in_distance_meters)}m from HQ`
                        : 'Remote GPS'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Status Verdict</span>
                    <span className="text-slate-800 font-bold text-sm">{todayRecord.final_status}</span>
                    <span className="text-[10px] text-blue-600 block mt-1">Google Sheets Synced</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Geofence Radar & Office Perimeter Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600" />
                  <span>GPS Geofence Radar</span>
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  isInsideFence ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isInsideFence ? 'Within Perimeter' : 'Outside Geofence'}
                </span>
              </div>

              {/* Pulsing Visual Radar Display */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 rounded-full border-2 border-dashed border-blue-300 flex items-center justify-center bg-blue-50/30">
                  <div className={`absolute inset-4 rounded-full border transition-all ${
                    isInsideFence ? 'border-emerald-400 bg-emerald-50/40 animate-pulse' : 'border-red-300 bg-red-50/30'
                  }`} />
                  <div className="relative z-10 text-center">
                    <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center shadow-md ${
                      isInsideFence ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      <Navigation size={24} className={isInsideFence ? '' : 'animate-bounce'} />
                    </div>
                    <div className="mt-2 text-xs font-black text-slate-900">
                      {distanceToOffice !== null ? `${distanceToOffice} meters` : 'Acquiring GPS...'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">Distance to {office.name}</div>
                  </div>
                </div>
              </div>

              {/* Radar Metrics Table */}
              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <span>Authorized Perimeter:</span>
                  <span className="font-bold text-slate-900">{office.radius_meters} meters</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GPS Fix Accuracy:</span>
                  <span className="font-bold text-slate-900">{gpsLocation ? `±${gpsLocation.accuracy}m` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Office Latitude:</span>
                  <span className="font-mono text-[11px] text-slate-700">{office.latitude}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Office Longitude:</span>
                  <span className="font-mono text-[11px] text-slate-700">{office.longitude}</span>
                </div>
              </div>

              {gpsError && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  {gpsError}
                </div>
              )}
            </div>

            {/* Mobile PWA Guidance Card */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <Smartphone size={24} className="text-blue-300 mb-2" />
              <h4 className="text-sm font-bold text-white">Darwinbox Mobile Experience</h4>
              <p className="text-xs text-blue-100 mt-1">
                Install Assurance HR directly onto your phone's Home Screen for 1-tap mobile punches with full GPS support.
              </p>
              <div className="mt-4 pt-3 border-t border-blue-700/60 flex items-center justify-between text-[11px] text-blue-200">
                <span>iOS: Safari Share &gt; Add to Home Screen</span>
                <span>Android: Chrome Menu &gt; Install</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 2: DARWINBOX 7-COLUMN VISUAL CALENDAR & SUMMARY STATS
      ========================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Month Selector Bar & View Toggle */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <button
                onClick={() => changeMonth(1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => {
                  const d = new Date();
                  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle: Grid vs Table */}
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button
                  onClick={() => setCalendarViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    calendarViewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid size={14} />
                  <span>Visual Calendar</span>
                </button>
                <button
                  onClick={() => setCalendarViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    calendarViewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List size={14} />
                  <span>List Logs</span>
                </button>
              </div>

              <a
                href={`/api/admin/attendance/export?month=${selectedMonth}`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </a>

              <button
                onClick={() => setShowRegModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-md shadow-blue-500/20"
              >
                <Clock size={14} />
                <span>Regularize</span>
              </button>
            </div>
          </div>

          {/* Darwinbox Stats Metric Cards */}
          {monthStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Punched</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{monthStats.total_punched_days}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Recorded Days</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present (Full Day)</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{monthStats.present_count}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">On-Time &gt; 4h</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-red-200/80 bg-red-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Late Marks</div>
                <div className="text-2xl font-black text-red-700 mt-1">{monthStats.late_count}</div>
                <div className="text-[10px] text-red-600 font-semibold mt-0.5">&gt; 15m Grace</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-red-200/80 bg-red-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Early Exits</div>
                <div className="text-2xl font-black text-red-700 mt-1">{monthStats.early_exit_count || 0}</div>
                <div className="text-[10px] text-red-600 font-semibold mt-0.5">Before Shift End</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Half Days</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{monthStats.half_day_count}</div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">&lt; 4 Hours</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">WFH / On-Duty</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {monthStats.wfh_count + monthStats.on_duty_count}
                </div>
                <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Remote Logged</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total Work Hours</div>
                <div className="text-2xl font-black text-purple-700 mt-1">{monthStats.total_work_hours}h</div>
                <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Avg: {monthStats.avg_daily_hours}h/day</div>
              </div>
            </div>
          )}

          {/* VISUAL 7-COLUMN CALENDAR GRID */}
          {calendarViewMode === 'grid' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Color Codes: <span className="text-emerald-700 font-bold">Green = Present</span>, <span className="text-red-600 font-bold">Red = Late / Early Exit</span>, <span className="text-amber-600 font-bold">Orange = Half Day</span>, <span className="text-purple-600 font-bold">Purple = Holiday</span>
                  </p>
                </div>
              </div>

              {/* Day Headers (Sun to Sat) */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <div className="py-2 text-rose-500">Sun</div>
                <div className="py-2">Mon</div>
                <div className="py-2">Tue</div>
                <div className="py-2">Wed</div>
                <div className="py-2">Thu</div>
                <div className="py-2">Fri</div>
                <div className="py-2 text-rose-500">Sat</div>
              </div>

              {/* Day Boxes Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty padding days for previous month */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="min-h-[90px] sm:min-h-[115px] p-2 rounded-xl bg-slate-50/50 border border-transparent opacity-30" />
                ))}

                {/* Actual days of the month */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayRecord = monthRecords.find((r) => r.attendance_date === dayDateStr);
                  const holiday = holidays.find((h) => h.holiday_date === dayDateStr);

                  const dayOfWeek = new Date(calYear, calMonth, dayNum).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  const todayStr = new Date().toISOString().split('T')[0];
                  const isToday = dayDateStr === todayStr;
                  const isPast = dayDateStr < todayStr;

                  const isLate = dayRecord?.is_late || dayRecord?.final_status === 'LATE';
                  const isEarlyExit = dayRecord?.is_early_exit === 1;

                  return (
                    <div
                      key={dayDateStr}
                      onClick={() => {
                        setSelectedDayRecord(dayRecord || null);
                        setSelectedDayHoliday(holiday || null);
                        setSelectedDayDate(dayDateStr);
                      }}
                      className={`min-h-[95px] sm:min-h-[120px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                        isToday
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                          : holiday
                          ? 'border-purple-200 bg-purple-50/30'
                          : isLate || isEarlyExit
                          ? 'border-red-200 bg-red-50/20'
                          : dayRecord
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : isWeekend
                          ? 'border-slate-100 bg-slate-50/60'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                            : isWeekend
                            ? 'text-rose-500'
                            : 'text-slate-800'
                        }`}>
                          {dayNum}
                        </span>

                        {holiday && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Sparkles size={10} />
                            <span className="hidden sm:inline">Holiday</span>
                          </span>
                        )}
                      </div>

                      {/* Content Badges */}
                      <div className="mt-1 space-y-1">
                        {holiday && (
                          <div className="text-[10px] font-extrabold text-purple-800 bg-purple-100/80 px-1.5 py-1 rounded-lg truncate">
                            🎉 {holiday.name}
                          </div>
                        )}

                        {dayRecord ? (
                          <>
                            {/* Times */}
                            <div className="text-[10px] font-mono text-slate-600 truncate font-semibold">
                              {dayRecord.check_in_time ? new Date(dayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              {dayRecord.check_out_time ? ' - ' + new Date(dayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>

                            {/* Red Marker for Late Arrival */}
                            {isLate && (
                              <div className="text-[9px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <span>🔴 LATE</span>
                              </div>
                            )}

                            {/* Red Marker for Early Exit */}
                            {isEarlyExit && (
                              <div className="text-[9px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <span>🔴 LEFT EARLY</span>
                              </div>
                            )}

                            {/* Status badge if on time and not early */}
                            {!isLate && !isEarlyExit && (
                              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                dayRecord.final_status === 'HALF_DAY'
                                  ? 'bg-amber-100 text-amber-800'
                                  : dayRecord.work_mode === 'wfh'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {dayRecord.final_status || 'PRESENT'}
                              </div>
                            )}
                          </>
                        ) : !holiday && isWeekend ? (
                          <div className="text-[10px] font-semibold text-slate-400">Weekly Off</div>
                        ) : !holiday && isPast ? (
                          <div className="text-[10px] font-semibold text-slate-400">Absent</div>
                        ) : isToday ? (
                          <div className="text-[10px] font-bold text-blue-600">Active Day</div>
                        ) : null}
                      </div>

                      {/* Footer Info (Total Hours) */}
                      <div className="text-[9px] font-semibold text-slate-400 mt-1">
                        {dayRecord?.total_work_minutes
                          ? `${Math.floor(dayRecord.total_work_minutes / 60)}h ${dayRecord.total_work_minutes % 60}m`
                          : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIST / TABLE VIEW */}
          {calendarViewMode === 'table' && (
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
                        <th className="py-3 px-4">Late Arrival</th>
                        <th className="py-3 px-4">Early Exit</th>
                        <th className="py-3 px-4">Distance</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthRecords.map((rec) => {
                        const totalHours = rec.total_work_minutes ? Math.floor(rec.total_work_minutes / 60) : 0;
                        const totalMins = rec.total_work_minutes ? rec.total_work_minutes % 60 : 0;
                        const status = rec.final_status?.toUpperCase() || 'PRESENT';
                        const isLate = rec.is_late || status === 'LATE';

                        return (
                          <tr
                            key={rec.id}
                            onClick={() => {
                              setSelectedDayRecord(rec);
                              setSelectedDayDate(rec.attendance_date);
                            }}
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
                                    ? 'bg-red-100 text-red-800'
                                    : status === 'HALF_DAY'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isLate ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white">
                                  RED: LATE
                                </span>
                              ) : (
                                <span className="text-slate-400">On Time</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {rec.is_early_exit ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white">
                                  RED: EARLY
                                </span>
                              ) : (
                                <span className="text-slate-400">Normal</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {rec.check_in_distance_meters !== null && rec.check_in_distance_meters !== undefined
                                ? `${Math.round(rec.check_in_distance_meters)}m`
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayRecord(rec);
                                  setSelectedDayDate(rec.attendance_date);
                                }}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                              >
                                View
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
          )}
        </div>
      )}

      {/* ==========================================================================
          TAB 3: ADMIN LIVE ROSTER DASHBOARD
      ========================================================================== */}
      {activeTab === 'admin-roster' && canManageAttendance && (
        <div className="space-y-6">
          {/* Top Filter Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
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
                  placeholder="Search staff by name or email..."
                  value={adminSearch}
                  onChange={(e) => {
                    setAdminSearch(e.target.value);
                    loadAdminRoster(adminDate, e.target.value);
                  }}
                  className="pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none w-56 sm:w-64"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAssignForm({
                    user_id: '',
                    attendance_date: adminDate,
                    check_in_time: '10:00:00',
                    check_out_time: '19:00:00',
                    work_mode: 'office',
                    notes: 'HR Assigned Punch',
                  });
                  setShowAssignModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                <Plus size={14} />
                <span>Assign Punch</span>
              </button>

              <a
                href={`/api/admin/attendance/export?date=${adminDate}`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Download size={14} />
                <span>Export Daily CSV</span>
              </a>
            </div>
          </div>

          {/* Metric Summary Cards */}
          {adminSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Staff</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{adminSummary.total_staff}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Assigned Agency Users</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present (In-Office)</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{adminSummary.present_office}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Inside Geofence</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Work From Home</div>
                <div className="text-2xl font-black text-blue-700 mt-1">{adminSummary.wfh}</div>
                <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Remote Authorization</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">On-Duty / Field</div>
                <div className="text-2xl font-black text-indigo-700 mt-1">{adminSummary.on_duty}</div>
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Client Location</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Late Arrivals</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{adminSummary.late}</div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Past 10:15 AM</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-red-200/80 bg-red-50/20 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Not Punched</div>
                <div className="text-2xl font-black text-red-700 mt-1">{adminSummary.not_punched}</div>
                <div className="text-[10px] text-red-600 font-semibold mt-0.5">Absent / Inactive</div>
              </div>
            </div>
          )}

          {/* Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Staff Presence Roster for {adminDate} ({adminRoster.length} Members)
              </h3>
              <span className="text-xs text-slate-500">Live check-in timestamps, GPS distances, and status flags</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Check-In</th>
                    <th className="py-3 px-4">Check-Out</th>
                    <th className="py-3 px-4">Distance</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminRoster.map((s) => {
                    const totalHours = s.total_work_minutes ? Math.floor(s.total_work_minutes / 60) : 0;
                    const totalMins = s.total_work_minutes ? s.total_work_minutes % 60 : 0;
                    const isLate = s.status === 'LATE' || s.check_in_status === 'late';
                    const isEarly = s.is_early_exit === 1;

                    return (
                      <tr key={s.user_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.user_name}</div>
                          <div className="text-[11px] text-slate-400">{s.user_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                            {s.user_role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              s.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'LATE'
                                ? 'bg-red-100 text-red-800'
                                : s.status === 'HALF_DAY'
                                ? 'bg-amber-100 text-amber-800'
                                : s.status === 'NOT_PUNCHED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {s.work_mode || 'OFFICE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          {isLate && <span className="ml-1 text-[9px] font-bold text-red-600">(LATE)</span>}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : s.attendance_id ? 'Active' : '—'}
                          {isEarly && <span className="ml-1 text-[9px] font-bold text-red-600">(EARLY)</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {s.check_in_distance_meters !== null && s.check_in_distance_meters !== undefined
                            ? `${Math.round(s.check_in_distance_meters)}m`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {s.total_work_minutes ? `${totalHours}h ${totalMins}m` : s.attendance_id ? 'In Progress' : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setAssignForm({
                                user_id: s.user_id,
                                attendance_date: adminDate,
                                check_in_time: s.check_in_time ? new Date(s.check_in_time).toTimeString().split(' ')[0] : '10:00:00',
                                check_out_time: s.check_out_time ? new Date(s.check_out_time).toTimeString().split(' ')[0] : '19:00:00',
                                work_mode: s.work_mode || 'office',
                                notes: s.notes || 'HR Assigned Punch',
                              });
                              setShowAssignModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors"
                          >
                            Assign Punch
                          </button>
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

      {/* ==========================================================================
          TAB 4: ADMIN ATTENDANCE REGULARIZATIONS
      ========================================================================== */}
      {activeTab === 'admin-regularize' && canManageAttendance && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Attendance Regularization Requests</h3>
            <p className="text-xs text-slate-500 mb-6">
              Review and approve employee missed punch regularization requests. Approving auto-updates their attendance record.
            </p>

            {adminRegs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="text-sm font-semibold text-slate-700">No pending regularization requests</p>
                <p className="text-xs mt-1 text-slate-400">Employee submissions will appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {adminRegs.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{reg.user_name}</span>
                        <span className="text-xs text-slate-400">({reg.user_email})</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            reg.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : reg.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {reg.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Date</span>
                          <span className="font-semibold text-slate-800">{reg.attendance_date}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Requested Times</span>
                          <span className="font-semibold text-slate-800">{reg.requested_check_in} - {reg.requested_check_out}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Work Mode</span>
                          <span className="font-semibold text-slate-800 uppercase">{reg.work_mode}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Submitted</span>
                          <span className="font-semibold text-slate-800">{new Date(reg.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-700">Reason: </span>
                        <span className="text-slate-600">{reg.reason}</span>
                      </div>
                    </div>

                    {reg.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReviewReg(reg.id, 'approve')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewReg(reg.id, 'reject')}
                          className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 5: COMPANY HOLIDAYS MANAGEMENT
      ========================================================================== */}
      {activeTab === 'admin-holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Holiday Form */}
          {canManageAttendance && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" />
                <span>Add Company Holiday</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Holidays display in festive purple on the visual calendar and exempt staff from absence marking.
              </p>

              {holidaySuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  {holidaySuccess}
                </div>
              )}

              {holidayError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                  {holidayError}
                </div>
              )}

              <form onSubmit={handleAddHoliday} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Holiday Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali, Independence Day, Christmas"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Holiday Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newHoliday.holiday_date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Description / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Festival of Lights - Office Closed"
                    value={newHoliday.description}
                    onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>{savingHoliday ? 'Saving Holiday...' : 'Save Company Holiday'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Holidays List */}
          <div className={`space-y-4 ${canManageAttendance ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Official Company Holidays ({holidays.length})
                  </h3>
                  <p className="text-xs text-slate-500">Official festive and national calendar holidays</p>
                </div>
              </div>

              {holidays.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Sparkles size={36} className="mx-auto mb-2 text-purple-400 opacity-50" />
                  <p className="text-sm font-semibold text-slate-700">No company holidays registered</p>
                  <p className="text-xs mt-1 text-slate-400">Add holidays using the form on the left.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 mt-2">
                  {holidays.map((h) => (
                    <div key={h.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
                          {new Date(h.holiday_date).getDate()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{h.name}</span>
                            <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                              {new Date(h.holiday_date).toLocaleString('default', { month: 'short', weekday: 'short' })}
                            </span>
                          </div>
                          {h.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{h.description}</div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{h.holiday_date}</div>
                        </div>
                      </div>

                      {canManageAttendance && (
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Holiday"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 6: ACCESS DELEGATION (Super Admin Only)
      ========================================================================== */}
      {activeTab === 'admin-permissions' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock size={18} className="text-amber-600" />
                  <span>Attendance Management Access Delegation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Grant trusted team members full attendance admin rights. Users with access can view the live roster, 
                  review regularizations, assign manual punches, add company holidays, and configure office geofences.
                </p>
              </div>
            </div>

            {loadingStaff ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading agency staff...</div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Attendance Admin Status</th>
                      <th className="py-3 px-4 text-right">Access Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((s) => {
                      const isOwner = s.role === 'super_admin' || s.role === 'support_manager';
                      const hasAccess = isOwner || Boolean(s.can_manage_attendance);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center uppercase text-xs">
                              {s.name.charAt(0)}
                            </div>
                            <span>{s.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{s.email}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                              {s.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {isOwner ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">
                                Full Admin (By Role)
                              </span>
                            ) : hasAccess ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase flex items-center gap-1 w-max">
                                <Check size={12} />
                                <span>Delegated Access</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase">
                                Employee Only
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isOwner ? (
                              <span className="text-[11px] text-slate-400 italic">Built-in Role</span>
                            ) : (
                              <button
                                onClick={() => handleTogglePermission(s.id, Boolean(s.can_manage_attendance))}
                                disabled={togglingUser === s.id}
                                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                                  hasAccess
                                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                }`}
                              >
                                {togglingUser === s.id ? 'Updating...' : hasAccess ? 'Revoke Access' : 'Grant Full Access'}
                              </button>
                            )}
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

      {/* ==========================================================================
          TAB 7: ADMIN OFFICE GEOFENCE & SHIFT SCHEDULE SETTINGS
      ========================================================================== */}
      {activeTab === 'admin-settings' && canManageAttendance && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900 mb-1">Office Location & Shift Configuration</h3>
          <p className="text-xs text-slate-500 mb-6">
            Update headquarters GPS coordinates, perimeter radius, and company shift timings.
          </p>

          {officeSaveMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{officeSaveMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveOffice} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Office Name</label>
              <input
                type="text"
                value={officeForm.name}
                onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={officeForm.latitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, latitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={officeForm.longitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, longitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Allowed Radius (Meters)</label>
                <input
                  type="number"
                  value={officeForm.radius_meters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radius_meters: parseInt(e.target.value, 10) || 100 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Shift Start Time</label>
                <input
                  type="time"
                  step="1"
                  value={officeForm.shift_start}
                  onChange={(e) => setOfficeForm({ ...officeForm, shift_start: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Shift End Time</label>
                <input
                  type="time"
                  step="1"
                  value={officeForm.shift_end}
                  onChange={(e) => setOfficeForm({ ...officeForm, shift_end: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  value={officeForm.grace_period_minutes}
                  onChange={(e) => setOfficeForm({ ...officeForm, grace_period_minutes: parseInt(e.target.value, 10) || 15 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingOffice}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                {savingOffice ? 'Saving Changes...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          MODAL: MANUAL PUNCH ASSIGNMENT (Admin & Attendance Managers)
      ========================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                <span>Assign / Adjust Punch Times</span>
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {assignSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                Punch assigned and synchronized successfully!
              </div>
            )}

            {assignError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignPunchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Target Employee *</label>
                {staffList.length > 0 ? (
                  <select
                    required
                    value={assignForm.user_id}
                    onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select an employee...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter Employee ID (e.g. usr-...)"
                    value={assignForm.user_id}
                    onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Attendance Date *</label>
                <input
                  type="date"
                  required
                  value={assignForm.attendance_date}
                  onChange={(e) => setAssignForm({ ...assignForm, attendance_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Check-In Time *</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={assignForm.check_in_time}
                    onChange={(e) => setAssignForm({ ...assignForm, check_in_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    step="1"
                    value={assignForm.check_out_time}
                    onChange={(e) => setAssignForm({ ...assignForm, check_out_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Work Mode</label>
                <select
                  value={assignForm.work_mode}
                  onChange={(e) => setAssignForm({ ...assignForm, work_mode: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="office">In-Office</option>
                  <option value="wfh">Work From Home (WFH)</option>
                  <option value="on_duty">On-Duty / Field</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">HR Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Approved manual shift punch adjustment"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningPunch}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  {assigningPunch ? 'Assigning...' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: ATTENDANCE REGULARIZATION (Employee Self-Service)
      ========================================================================== */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                <span>Attendance Regularization Request</span>
              </h3>
              <button
                onClick={() => setShowRegModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {regSuccess ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Regularization Request Submitted!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Sent to HR/Admin for approval. You will be notified once reviewed.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRegularization} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date to Regularize *</label>
                  <input
                    type="date"
                    required
                    value={regForm.attendance_date}
                    onChange={(e) => setRegForm({ ...regForm, attendance_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Actual Check-In *</label>
                    <input
                      type="time"
                      step="1"
                      required
                      value={regForm.requested_check_in}
                      onChange={(e) => setRegForm({ ...regForm, requested_check_in: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Actual Check-Out *</label>
                    <input
                      type="time"
                      step="1"
                      required
                      value={regForm.requested_check_out}
                      onChange={(e) => setRegForm({ ...regForm, requested_check_out: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Work Mode</label>
                  <select
                    value={regForm.work_mode}
                    onChange={(e) => setRegForm({ ...regForm, work_mode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="office">In-Office</option>
                    <option value="wfh">Work From Home (WFH)</option>
                    <option value="on_duty">On-Duty / Field Visit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Reason for Regularization *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Explain why punch was missed (e.g. Client meeting outside, technical device issue)..."
                    value={regForm.reason}
                    onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReg}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
                  >
                    {submittingReg ? 'Submitting...' : 'Send for Approval'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: DAY AUDIT & DETAILS DRAWER
      ========================================================================== */}
      {(selectedDayRecord || selectedDayHoliday || selectedDayDate) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Attendance Details for {selectedDayDate || selectedDayRecord?.attendance_date}
                </h3>
                <span className="text-xs text-slate-500">Official log and GPS audit entry</span>
              </div>
              <button
                onClick={() => {
                  setSelectedDayRecord(null);
                  setSelectedDayHoliday(null);
                  setSelectedDayDate(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {selectedDayHoliday && (
              <div className="mb-4 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                <div className="font-extrabold text-sm flex items-center gap-1.5">
                  <Sparkles size={16} className="text-purple-600" />
                  <span>Company Holiday: {selectedDayHoliday.name}</span>
                </div>
                {selectedDayHoliday.description && (
                  <div className="text-xs text-purple-700 mt-1">{selectedDayHoliday.description}</div>
                )}
              </div>
            )}

            {selectedDayRecord ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Check-In</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedDayRecord.check_in_time ? new Date(selectedDayRecord.check_in_time).toLocaleTimeString() : '—'}
                    </span>
                    {selectedDayRecord.is_late || selectedDayRecord.final_status === 'LATE' ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">
                        🔴 LATE ARRIVAL
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[10px] text-emerald-600 font-semibold">On-Time</span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Check-Out</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedDayRecord.check_out_time ? new Date(selectedDayRecord.check_out_time).toLocaleTimeString() : 'Active'}
                    </span>
                    {selectedDayRecord.is_early_exit ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">
                        🔴 LEFT EARLY
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[10px] text-slate-500">Regular Exit</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Work Mode:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedDayRecord.work_mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Duration:</span>
                    <span className="font-bold text-slate-800">
                      {selectedDayRecord.total_work_minutes
                        ? `${Math.floor(selectedDayRecord.total_work_minutes / 60)}h ${selectedDayRecord.total_work_minutes % 60}m`
                        : 'In Progress'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Geofence Distance:</span>
                    <span className="font-bold text-slate-800">
                      {selectedDayRecord.check_in_distance_meters !== null && selectedDayRecord.check_in_distance_meters !== undefined
                        ? `${Math.round(selectedDayRecord.check_in_distance_meters)} meters`
                        : 'Remote'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Final Status:</span>
                    <span className="font-bold text-slate-800">{selectedDayRecord.final_status}</span>
                  </div>
                </div>

                {selectedDayRecord.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 block mb-0.5">Remarks / Audit Note:</span>
                    <p className="text-slate-600">{selectedDayRecord.notes}</p>
                  </div>
                )}
              </div>
            ) : !selectedDayHoliday ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No attendance recorded for this date.
              </div>
            ) : null}

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              {canManageAttendance && (
                <button
                  onClick={() => {
                    setAssignForm({
                      user_id: selectedDayRecord?.user_id || user?.id || '',
                      attendance_date: selectedDayDate || selectedDayRecord?.attendance_date || new Date().toISOString().split('T')[0],
                      check_in_time: selectedDayRecord?.check_in_time ? new Date(selectedDayRecord.check_in_time).toTimeString().split(' ')[0] : '10:00:00',
                      check_out_time: selectedDayRecord?.check_out_time ? new Date(selectedDayRecord.check_out_time).toTimeString().split(' ')[0] : '19:00:00',
                      work_mode: selectedDayRecord?.work_mode || 'office',
                      notes: selectedDayRecord?.notes || 'HR Assigned Punch',
                    });
                    setSelectedDayRecord(null);
                    setSelectedDayHoliday(null);
                    setSelectedDayDate(null);
                    setShowAssignModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 flex items-center gap-1"
                >
                  <Edit3 size={13} />
                  <span>Assign / Edit Punch</span>
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedDayRecord(null);
                  setSelectedDayHoliday(null);
                  setSelectedDayDate(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs ml-auto"
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
