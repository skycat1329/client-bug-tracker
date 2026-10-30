import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Save,
  HelpCircle,
  Building2,
  Layers,
  Sparkles,
} from 'lucide-react';

export const GoogleSheetsPage: React.FC = () => {
  const [config, setConfig] = useState<{
    enabled: boolean;
    global_webhook_url: string;
    create_brand_tabs: boolean;
  }>({
    enabled: false,
    global_webhook_url: '',
    create_brand_tabs: true,
  });

  const [brands, setBrands] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [syncingAttendance, setSyncingAttendance] = useState(false);
  const [syncAttendanceResult, setSyncAttendanceResult] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Per-brand modal / editing
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandSheetUrl, setBrandSheetUrl] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

  const googleAppsScriptCode = `// ==============================================================================
// Client Bug Tracker - Google Sheets Real-Time Sync Webhook
// ==============================================================================
// Instructions:
// 1. In Google Sheets, click: Extensions > Apps Script
// 2. Paste this complete script replacing any existing code
// 3. Click "Deploy" > "New deployment"
// 4. Select Type: "Web app"
// 5. Execute as: "Me"
// 6. Who has access: "Anyone" (CRITICAL: Do NOT choose "Anyone within your company", choose "Anyone" so the server webhook can deliver updates!)
// 7. Click "Deploy" and copy the Web App URL (ends in /exec)
// 8. Paste the Web App URL into your Bug Tracker Google Sheets Sync settings!
// ==============================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for concurrency lock

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Attendance Sync (Master Log + Dedicated Employee Sheets)
    if (data.sheet_type === "attendance") {
      // 1A. Master Log
      var attSheet = ss.getSheetByName("Attendance Log");
      if (!attSheet) {
        attSheet = ss.insertSheet("Attendance Log");
        setupAttendanceHeaders(attSheet);
      }
      appendAttendanceRow(attSheet, data);

      // 1B. Dedicated Employee Tab
      var empName = (data.employee_name || "Employee").trim();
      var cleanEmpTab = empName.replace(/[:\\\\/?*\\[\\]]/g, "-").substring(0, 30);
      var userSheet = ss.getSheetByName(cleanEmpTab);
      if (!userSheet) {
        userSheet = ss.insertSheet(cleanEmpTab);
        setupUserAttendanceDashboard(userSheet, data, cleanEmpTab);
      }
      appendOrUpdateUserAttendance(userSheet, data);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        type: "attendance",
        user_tab: cleanEmpTab,
        timestamp: data.timestamp || new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Tasks Sync
    if (data.sheet_type === "tasks") {
      var taskSheet = ss.getSheetByName("Engineering Tasks");
      if (!taskSheet) {
        taskSheet = ss.insertSheet("Engineering Tasks");
        setupTaskHeaders(taskSheet);
      }
      appendTaskRow(taskSheet, data);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        type: "tasks",
        timestamp: data.timestamp || new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Brand Ticket Log & Master Audit Trail
    var brandName = (data.brand_name || "General Brand").trim();
    var cleanBrandTab = brandName.replace(/[:\\\\/?*\\[\\]]/g, "-").substring(0, 50);

    var brandSheet = ss.getSheetByName(cleanBrandTab);
    if (!brandSheet) {
      brandSheet = ss.insertSheet(cleanBrandTab);
      setupHeaders(brandSheet, cleanBrandTab);
    }
    appendRowToSheet(brandSheet, data);

    var masterSheet = ss.getSheetByName("All Brands Master Log");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("All Brands Master Log");
      setupHeaders(masterSheet, "All Brands Master Audit Trail");
    }
    appendRowToSheet(masterSheet, data);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      brand_tab: cleanBrandTab,
      timestamp: data.timestamp || new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Assurance Media Google Sheets Webhook is active and listening for Attendance & Ticket updates!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function setupHeaders(sheet, title) {
  var headers = [
    "Date & Time",
    "Brand",
    "Ticket ID",
    "Event / Action",
    "Status",
    "Priority",
    "Ticket Title",
    "Managed Website",
    "Requester",
    "Assignee Specialist",
    "Action Details / Notes",
    "Environment",
    "Actor / Performed By"
  ];
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setFontColor("#FFFFFF");
  range.setBackground("#0176D3");
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function appendRowToSheet(sheet, data) {
  sheet.appendRow([
    data.timestamp || new Date().toLocaleString(),
    data.brand_name || "",
    data.ticket_number || "",
    data.event || "",
    data.status || "",
    data.priority || "",
    data.ticket_title || "",
    data.website_name || "",
    data.requester_name || "",
    data.assignee_name || "Unassigned",
    data.details || "",
    data.environment || "production",
    data.actor_name || "System"
  ]);
}

function setupAttendanceHeaders(sheet) {
  var headers = [
    "Timestamp",
    "Date",
    "Employee Name",
    "Email",
    "Role",
    "Work Mode",
    "Shift",
    "Check-In",
    "Check-Out",
    "Total Hours",
    "Status",
    "Late Arrival?",
    "Early Exit?",
    "Distance (m)",
    "Geofence Verdict",
    "Notes"
  ];
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setFontColor("#FFFFFF");
  range.setBackground("#059669"); // Emerald Green
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function appendAttendanceRow(sheet, data) {
  sheet.appendRow([
    data.timestamp || new Date().toLocaleString(),
    data.attendance_date || "",
    data.employee_name || "",
    data.employee_email || "",
    data.role || "",
    data.work_mode || "OFFICE",
    data.shift || "10:00 AM - 07:00 PM",
    data.check_in_time || "",
    data.check_out_time || "",
    data.total_hours || 0,
    data.status || "PRESENT",
    data.is_late || "NO",
    data.is_early_exit || "NO",
    data.distance_meters !== null && data.distance_meters !== undefined ? data.distance_meters : "",
    data.geofence_status || "",
    data.notes || ""
  ]);
}

function setupUserAttendanceDashboard(sheet, data, tabName) {
  // Title Banner
  sheet.getRange("A1:G1").merge();
  var titleCell = sheet.getRange("A1");
  titleCell.setValue("ATTENDANCE SCOREBOARD: " + (data.employee_name || tabName).toUpperCase());
  titleCell.setFontWeight("bold");
  titleCell.setFontSize(14);
  titleCell.setFontColor("#FFFFFF");
  titleCell.setBackground("#0F172A");
  titleCell.setHorizontalAlignment("center");

  // Subtitle
  sheet.getRange("A2:G2").merge();
  var subCell = sheet.getRange("A2");
  subCell.setValue("Email: " + (data.employee_email || "N/A") + "  |  Role: " + (data.role || "Staff") + "  |  ID: " + (data.user_id || "N/A"));
  subCell.setFontSize(10);
  subCell.setFontColor("#94A3B8");
  subCell.setBackground("#1E293B");
  subCell.setHorizontalAlignment("center");

  // Metric Cards Headers (Row 4)
  var kpiHeaders = ["Total Punched Days", "Full Days", "Half Days", "Late Marks", "Early Exits", "WFH / OD", "Total Hours"];
  for (var i = 0; i < kpiHeaders.length; i++) {
    sheet.getRange(4, i + 1).setValue(kpiHeaders[i]);
  }
  var kpiHeaderRange = sheet.getRange("A4:G4");
  kpiHeaderRange.setFontWeight("bold");
  kpiHeaderRange.setFontSize(9);
  kpiHeaderRange.setHorizontalAlignment("center");
  kpiHeaderRange.setBackground("#E2E8F0");
  kpiHeaderRange.setFontColor("#475569");

  // Formulas (Row 5)
  sheet.getRange("A5").setFormula("=COUNTA(A10:A)");
  sheet.getRange("B5").setFormula("=COUNTIF(G10:G, \\\"PRESENT\\\") + COUNTIF(G10:G, \\\"REGULARIZED\\\")");
  sheet.getRange("C5").setFormula("=COUNTIF(G10:G, \\\"HALF_DAY\\\")");
  sheet.getRange("D5").setFormula("=COUNTIF(H10:H, \\\"YES\\\") + COUNTIF(G10:G, \\\"LATE\\\")");
  sheet.getRange("E5").setFormula("=COUNTIF(I10:I, \\\"YES\\\")");
  sheet.getRange("F5").setFormula("=COUNTIF(B10:B, \\\"WFH\\\") + COUNTIF(B10:B, \\\"ON_DUTY\\\")");
  sheet.getRange("G5").setFormula("=SUM(F10:F)");

  var kpiValRange = sheet.getRange("A5:G5");
  kpiValRange.setFontWeight("bold");
  kpiValRange.setFontSize(15);
  kpiValRange.setHorizontalAlignment("center");
  kpiValRange.setBackground("#F8FAFC");
  sheet.getRange("B5").setFontColor("#16A34A");
  sheet.getRange("C5").setFontColor("#EA580C");
  sheet.getRange("D5").setFontColor("#DC2626");
  sheet.getRange("E5").setFontColor("#DC2626");
  sheet.getRange("F5").setFontColor("#2563EB");
  sheet.getRange("G5").setFontColor("#0F172A");

  // Log Section Header (Row 8)
  sheet.getRange("A8:M8").merge();
  var logTitle = sheet.getRange("A8");
  logTitle.setValue("DAILY ATTENDANCE LOGS & PUNCH RECORDS");
  logTitle.setFontWeight("bold");
  logTitle.setFontSize(10);
  logTitle.setFontColor("#334155");

  // Table Column Headers (Row 9)
  var tableHeaders = [
    "Date",
    "Work Mode",
    "Shift Hours",
    "Check-In Time",
    "Check-Out Time",
    "Total Hours",
    "Status",
    "Late Arrival?",
    "Early Exit?",
    "Distance (m)",
    "Geofence",
    "Notes",
    "Last Updated"
  ];
  sheet.appendRow(tableHeaders);
  var thRange = sheet.getRange(9, 1, 1, tableHeaders.length);
  thRange.setFontWeight("bold");
  thRange.setFontColor("#FFFFFF");
  thRange.setBackground("#2563EB");
  thRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(9);
}

function appendOrUpdateUserAttendance(sheet, data) {
  var dateStr = data.attendance_date || "";
  var lastRow = sheet.getLastRow();
  var existingRowIndex = -1;

  if (lastRow >= 10 && dateStr) {
    var dateValues = sheet.getRange(10, 1, lastRow - 9, 1).getValues();
    for (var i = 0; i < dateValues.length; i++) {
      var cellVal = dateValues[i][0];
      if (cellVal) {
        var strVal = (cellVal instanceof Date) ? Utilities.formatDate(cellVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : cellVal.toString().trim();
        if (strVal.indexOf(dateStr) !== -1) {
          existingRowIndex = 10 + i;
          break;
        }
      }
    }
  }

  var rowData = [
    dateStr,
    data.work_mode || "OFFICE",
    data.shift || "10:00 AM - 07:00 PM",
    data.check_in_time || "",
    data.check_out_time || "",
    data.total_hours || 0,
    data.status || "PRESENT",
    data.is_late || "NO",
    data.is_early_exit || "NO",
    data.distance_meters !== null && data.distance_meters !== undefined ? data.distance_meters : "",
    data.geofence_status || "",
    data.notes || "",
    data.timestamp || new Date().toLocaleString()
  ];

  if (existingRowIndex > 0) {
    sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function setupTaskHeaders(sheet) {
  var headers = [
    "Timestamp",
    "Task Number",
    "Title",
    "Assignee",
    "Creator",
    "Deadline",
    "Priority",
    "Status",
    "Notes"
  ];
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setFontColor("#FFFFFF");
  range.setBackground("#7C3AED"); // Purple
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function appendTaskRow(sheet, data) {
  sheet.appendRow([
    data.timestamp || new Date().toLocaleString(),
    data.task_number || "",
    data.title || "",
    data.assignee_name || "",
    data.creator_name || "",
    data.deadline || "",
    data.priority || "",
    data.status || "",
    data.description || ""
  ]);
}`;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/integrations/sheets/config');
      if (res.config) {
        setConfig(res.config);
      }
      setBrands(res.brands || []);
      setDeliveries(res.deliveries || []);
    } catch (err) {
      console.error('Failed to load Google Sheets config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.post('/integrations/sheets/config', config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGlobal = async (brandId?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<any>('/integrations/sheets/test', {
        webhook_url: config.global_webhook_url,
        brand_id: brandId || (brands.length > 0 ? brands[0].id : null),
      });
      setTestResult(res);
      await loadData();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAttendanceToday = async () => {
    setSyncingAttendance(true);
    setSyncAttendanceResult(null);
    try {
      const res = await api.post<any>('/attendance/sync-sheets', {});
      setSyncAttendanceResult(res);
      await loadData();
    } catch (err: any) {
      setSyncAttendanceResult({ success: false, message: err.message });
    } finally {
      setSyncingAttendance(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveBrandSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    setSavingBrand(true);
    try {
      await api.post(`/organizations/${editingBrand.id}/sheets-url`, {
        google_sheet_url: brandSheetUrl.trim(),
      });
      setEditingBrand(null);
      await loadData();
    } catch (err: any) {
      alert('Failed to update brand sheet URL: ' + err.message);
    } finally {
      setSavingBrand(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="text-emerald-600" size={28} />
            Google Sheets Real-Time Sync & Brand Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automatically streams ticket updates, assignments, status transitions, and resolution notes into isolated Google Sheets tabs for each brand.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            disabled={testing || (!config.global_webhook_url && !config.enabled)}
            onClick={() => handleTestGlobal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <Send size={13} />
            {testing ? 'Sending Test Row...' : 'Send Test Log Row'}
          </button>
          <button
            disabled={syncingAttendance}
            onClick={() => handleSyncAttendanceToday()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            title="Push all punch-in and punch-out records for today into Google Sheets"
          >
            <RefreshCw size={13} className={syncingAttendance ? 'animate-spin' : ''} />
            {syncingAttendance ? 'Syncing Attendance...' : "Sync Today's Attendance"}
          </button>
        </div>
      </div>

      {/* Sync Attendance Result Alert */}
      {syncAttendanceResult && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 shadow-sm ${
            syncAttendanceResult.success
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {syncAttendanceResult.success ? (
            <CheckCircle2 size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="font-semibold text-xs uppercase tracking-wider">
              {syncAttendanceResult.success ? 'Attendance Sync Completed' : 'Attendance Sync Failed'}
            </div>
            <p className="mt-0.5 text-xs">
              {syncAttendanceResult.message || (syncAttendanceResult.success ? `Synced ${syncAttendanceResult.synced_count} records.` : syncAttendanceResult.error)}
            </p>
          </div>
          <button
            onClick={() => setSyncAttendanceResult(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Test Result Alert */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 shadow-sm ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="font-semibold text-xs uppercase tracking-wider">
              {testResult.success ? 'Google Sheet Sync Verified' : 'Google Sheet Connection Failed'}
            </div>
            <p className="mt-0.5 text-xs">{testResult.message}</p>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Global Settings + Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Global Settings Form */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="text-emerald-600" size={18} />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Global Google Sheets Configuration
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  config.enabled && config.global_webhook_url
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    config.enabled && config.global_webhook_url
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                {config.enabled && config.global_webhook_url ? 'Auto-Sync Active' : 'Sync Inactive'}
              </span>
            </div>

            <form onSubmit={handleSaveGlobalConfig} className="mt-5 space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Enable Real-Time Google Sheets Logging
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Automatically dispatch rows whenever a ticket is raised, assigned, updated, or commented on.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Webhook URL Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Google Apps Script Web App URL (Global Spreadsheet)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={config.global_webhook_url}
                  onChange={(e) => setConfig({ ...config, global_webhook_url: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                {config.global_webhook_url.includes('docs.google.com/spreadsheets') && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
                    <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Spreadsheet Viewer URL Detected!</strong>
                      <p className="mt-0.5 text-[11.5px] text-amber-800">
                        You pasted the Google Spreadsheet edit/view URL. A spreadsheet cannot accept POST data directly and will return an HTTP 401 error. Please deploy the Apps Script code on the right as a <strong>Web App</strong> (Access: Anyone) and paste the Web App URL (starts with <code>https://script.google.com/.../exec</code>).
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  The Google Apps Script deployed from your master Google Sheet (see instructions on the right).
                </p>
              </div>

              {/* Multi-Tab Feature Highlight */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-lg text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Sparkles size={14} />
                  Automatic Brand Tab Separation
                </div>
                <p className="text-[11px] text-emerald-700">
                  When enabled, tickets for <strong>"enem"</strong> write to a dedicated tab named <code>enem</code>. Tickets for other brands write to their own separate tabs, and a unified master log tab aggregates all agency activity!
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Save size={13} />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
                {saveSuccess && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <Check size={14} /> Settings Saved!
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Google Apps Script Setup Guide */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-blue-600" size={18} />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2-Minute Google Sheets Setup Guide
                </h2>
              </div>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors"
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                {copiedCode ? 'Code Copied!' : 'Copy Script Code'}
              </button>
            </div>

            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Create a new spreadsheet at{' '}
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                >
                  sheets.new <ExternalLink size={10} />
                </a>
              </li>
              <li>
                Click on the top menu: <strong className="text-slate-800">Extensions &rarr; Apps Script</strong>.
              </li>
              <li>
                Delete any sample code and <strong className="text-slate-800">Paste</strong> the script code below.
              </li>
              <li>
                Click <strong className="text-slate-800">Deploy &rarr; New deployment</strong> in the top right.
              </li>
              <li>
                Select Type: <strong className="text-slate-800">Web app</strong>. Set Execute as: <strong className="text-slate-800">Me</strong> and Who has access: <strong className="text-blue-600 font-bold">Anyone</strong>.
              </li>
              <li>
                Click <strong className="text-slate-800">Deploy</strong>, copy the generated <strong className="text-slate-800">Web app URL</strong> (ends in <code>/exec</code>), and paste it into the box on the left!
              </li>
            </ol>

            {/* Script Snippet Preview */}
            <div className="relative">
              <pre className="text-[10px] bg-slate-900 text-slate-100 p-4 rounded-lg font-mono overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                {googleAppsScriptCode}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Brand Separation Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <Building2 className="text-blue-600" size={16} />
              Brand-Specific Google Sheets Routing & Isolation
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              By default, all brands automatically write into their own clean, separate tabs inside your Global Google Sheet. You can also specify an independent Google Sheet file URL for any client brand below.
            </p>
          </div>
        </div>

        {brands.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No brands registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Brand / Organization</th>
                  <th className="py-2.5 px-4">Brand Slug</th>
                  <th className="py-2.5 px-4">Google Sheets Destination</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{b.name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{b.slug}</td>
                    <td className="py-3 px-4">
                      {b.google_sheet_url ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[11px]">
                            Dedicated Custom Sheet File
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                            {b.google_sheet_url}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                          Dedicated Tab: <strong>"{b.name}"</strong> in Global Sheet
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingBrand(b);
                          setBrandSheetUrl(b.google_sheet_url || '');
                        }}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm"
                      >
                        {b.google_sheet_url ? 'Edit Custom URL' : 'Set Custom Sheet File'}
                      </button>
                      <button
                        onClick={() => handleTestGlobal(b.id)}
                        disabled={testing}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded shadow-sm"
                      >
                        Test Sync Row
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Deliveries Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <RefreshCw size={15} className="text-slate-500" />
            Recent Google Sheets Sync Log Activity
          </h2>
          <span className="text-xs text-slate-400">Last 30 sync attempts</span>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No Google Sheets sync operations recorded yet. Enable sync above to begin automatic logging.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date / Time</th>
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Brand / Tab</th>
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{d.created_at}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">{d.event}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{d.recipient}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600">
                      {d.ticket_number || (d.payload?.ticket_number) || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      {d.status === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                          <CheckCircle2 size={10} /> Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">
                          <AlertTriangle size={10} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-sm truncate text-[11px]">
                      {d.error_message || (d.payload?.details) || 'Successfully synced row'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Brand Custom Sheet Modal */}
      {editingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Custom Google Sheet URL for: {editingBrand.name}
              </h3>
              <button
                onClick={() => setEditingBrand(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              If this client brand needs their own separate Google Spreadsheet file, deploy the Apps Script in their workbook and paste their Web App URL below. Leave blank to use the Global Sheet (which logs into their dedicated tab).
            </p>

            <form onSubmit={handleSaveBrandSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec (leave blank to reset)"
                  value={brandSheetUrl}
                  onChange={(e) => setBrandSheetUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBrand(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBrand}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {savingBrand ? 'Saving...' : 'Save Brand Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
