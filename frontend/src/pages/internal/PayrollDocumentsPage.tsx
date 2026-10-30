import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  OfferLetter,
  PaySlip,
  EmploymentType,
  SalaryBreakupItem,
  OfferClause,
  SalaryComponent,
} from '../../types/index.js';
import {
  FileText,
  FileSignature,
  Plus,
  Search,
  Printer,
  Mail,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  Building2,
  User,
  DollarSign,
  Download,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Laptop,
  Clock,
  MapPin,
  X,
  CreditCard,
  Briefcase,
} from 'lucide-react';

export const PayrollDocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user ? ['super_admin', 'support_manager'].includes(user.role) : false;

  const [activeTab, setActiveTab] = useState<'offers' | 'slips'>('offers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data lists
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [slips, setSlips] = useState<PaySlip[]>([]);
  const [teamStaff, setTeamStaff] = useState<any[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferLetter | null>(null);

  const [showSlipModal, setShowSlipModal] = useState(false);
  const [editingSlip, setEditingSlip] = useState<PaySlip | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    type: 'offer' | 'slip';
    data: OfferLetter | PaySlip;
  } | null>(null);

  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  // --------------------------------------------------------------------------
  // Default Clauses (Matching Assurance Media Sample PDF)
  // --------------------------------------------------------------------------
  const defaultClauses: OfferClause[] = [
    {
      id: 'probation',
      title: 'Probation Period',
      content:
        'The first 15 days of the Job will be considered a probation period.\nDuring this period, the Company reserves the right to evaluate performance, conduct, and suitability for the role.\nDuring the probation period:\n• The Company may terminate the Job immediately, without notice and without any obligation to continue the Job.\n• Upon successful completion of the probation period, the Job will continue for the remaining agreed duration.',
      is_default: true,
    },
    {
      id: 'working_hours',
      title: 'Working Hours & Mode',
      content:
        'Work Mode: On Site\nWorking Days: Monday to Saturday (Office)\nWorking Hours: 10 AM – 6:30 PM',
      is_default: true,
    },
    {
      id: 'confidentiality',
      title: 'Confidentiality',
      content:
        'During and after your employment, you shall maintain strict confidentiality regarding all company information, client data, business strategies, pricing, and proprietary information.',
      is_default: true,
    },
    {
      id: 'termination',
      title: 'Termination',
      content:
        'In order to resign the notice should be given prior to 60 days. If not FNF (Full & Final) will not realise by the company.',
      is_default: true,
    },
    {
      id: 'acceptance',
      title: 'Acceptance of Offer',
      content:
        'Please confirm your acceptance of this offer by replying with "I accept" to this email or by signing and returning a copy of this letter.\nWe look forward to working with you and wish you a valuable learning experience with Assurance Media LLP.',
      is_default: true,
    },
    {
      id: 'leave_policy',
      title: 'Leave Policy',
      content:
        'You are required to submit your leave application to the authorities at least 15 days prior. And your leave will be granted only on the consent of the higher authority.',
      is_default: true,
    },
    {
      id: 'medical',
      title: 'Medical',
      content:
        'During first 180 days of employment, company will not be liable for any type of medical expenses.',
      is_default: true,
    },
    {
      id: 'insurance',
      title: 'Insurance Benefits',
      content:
        '• After completion of one (1) year of service:\nYou will be covered under a Personal Accidental Insurance Policy of ₹20,00,000 (Twenty Lakh) and a Health Insurance Policy of ₹5,00,000 (Five Lakh).',
      is_default: true,
    },
  ];

  // --------------------------------------------------------------------------
  // Offer Form State
  // --------------------------------------------------------------------------
  const [offerForm, setOfferForm] = useState({
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    candidate_address: '',
    employment_type: 'full_time' as EmploymentType,
    position: 'Web Developer',
    department: 'Tech',
    reporting_to: 'Management Team / Director',
    joining_date: new Date().toISOString().split('T')[0],
    work_location:
      '3rd Floor, 302, SHIV KRUPA CHS LTD, near Railway Station, Kirol Village, Vidyavihar West, Mumbai, M.H 400086',
    laptop_required: true,
    work_mode: 'On Site',
    working_days: 'Monday to Saturday (Office)',
    working_hours: '10 AM – 6:30 PM',
    monthly_salary: 15000,
    annual_ctc: 180000,
    payment_cycle: 'Monthly (13th of Every Month)',
    salary_breakup: [
      { item: 'Basic Salary', monthly: 15000, annual: 180000 },
    ] as SalaryBreakupItem[],
    clauses: defaultClauses,
    signatory_name: 'Mr. Faizan Siddiqui',
    signatory_title: 'Business Head',
  });

  // --------------------------------------------------------------------------
  // Pay Slip Form State
  // --------------------------------------------------------------------------
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const currentMonthName = months[new Date().getMonth()];
  const currentYearNum = new Date().getFullYear();

  const [slipForm, setSlipForm] = useState({
    employee_name: '',
    employee_id: 'AM' + String(Date.now()).slice(-6),
    employee_email: '',
    employee_phone: '',
    designation: 'Web Developer',
    department: 'Tech',
    date_of_joining: '',
    month: currentMonthName,
    year: currentYearNum,
    total_working_days: 30,
    lop_days: 0,
    paid_days: 30,
    bank_name: 'HDFC BANK',
    bank_account_no: '',
    earnings: [
      { label: 'Basic Salary', amount: 25000 },
      { label: 'Travel Allowances', amount: 0 },
      { label: 'Incentive', amount: 0 },
    ] as SalaryComponent[],
    deductions: [
      { label: 'LOP Deduction', amount: 0 },
      { label: 'Professional Tax (PT)', amount: 0 },
    ] as SalaryComponent[],
    signatory_label: 'Employer Signature',
  });

  // --------------------------------------------------------------------------
  // Load All Data
  // --------------------------------------------------------------------------
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [offersRes, slipsRes, staffRes] = await Promise.allSettled([
        api.get<{ success: boolean; offer_letters: OfferLetter[] }>('/payroll/offer-letters'),
        api.get<{ success: boolean; pay_slips: PaySlip[] }>('/payroll/pay-slips'),
        api.get<{ success: boolean; staff: any[] }>('/auth/staff'),
      ]);

      if (offersRes.status === 'fulfilled' && offersRes.value?.offer_letters) {
        setOffers(offersRes.value.offer_letters);
      }
      if (slipsRes.status === 'fulfilled' && slipsRes.value?.pay_slips) {
        setSlips(slipsRes.value.pay_slips);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value?.staff) {
        setTeamStaff(staffRes.value.staff);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load payroll documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------------------------------------------------
  // Number to Indian Rupees Words
  // --------------------------------------------------------------------------
  const convertRupeesToWords = (amount: number): string => {
    const rounded = Math.round(amount);
    if (rounded === 0) return 'Zero Rupees';

    const units = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    const convertBelowThousand = (n: number): string => {
      let str = '';
      if (n >= 100) {
        str += units[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)];
        const rem = n % 10;
        if (rem > 0) str += '-' + units[rem];
      } else if (n > 0) {
        str += units[n];
      }
      return str.trim();
    };

    const crores = Math.floor(rounded / 10000000);
    const remCrores = rounded % 10000000;
    const lakhs = Math.floor(remCrores / 100000);
    const remLakhs = remCrores % 100000;
    const thousands = Math.floor(remLakhs / 1000);
    const remThousands = remLakhs % 1000;

    const parts: string[] = [];
    if (crores > 0) parts.push(convertBelowThousand(crores) + ' Crore');
    if (lakhs > 0) parts.push(convertBelowThousand(lakhs) + ' Lakh');
    if (thousands > 0) parts.push(convertBelowThousand(thousands) + ' Thousand');
    if (remThousands > 0) {
      if (remThousands >= 100) {
        parts.push(convertBelowThousand(remThousands));
      } else {
        parts.push((parts.length > 0 ? '& ' : '') + convertBelowThousand(remThousands));
      }
    }

    return parts.join(' ');
  };

  // --------------------------------------------------------------------------
  // Offer Letter Handlers
  // --------------------------------------------------------------------------
  const handleOpenCreateOffer = () => {
    setEditingOffer(null);
    setOfferForm({
      candidate_name: '',
      candidate_email: '',
      candidate_phone: '',
      candidate_address: '',
      employment_type: 'full_time',
      position: 'Web Developer',
      department: 'Tech',
      reporting_to: 'Management Team / Director',
      joining_date: new Date().toISOString().split('T')[0],
      work_location:
        '3rd Floor, 302, SHIV KRUPA CHS LTD, near Railway Station, Kirol Village, Vidyavihar West, Mumbai, M.H 400086',
      laptop_required: true,
      work_mode: 'On Site',
      working_days: 'Monday to Saturday (Office)',
      working_hours: '10 AM – 6:30 PM',
      monthly_salary: 15000,
      annual_ctc: 180000,
      payment_cycle: 'Monthly (13th of Every Month)',
      salary_breakup: [{ item: 'Basic Salary', monthly: 15000, annual: 180000 }],
      clauses: defaultClauses,
      signatory_name: 'Mr. Faizan Siddiqui',
      signatory_title: 'Business Head',
    });
    setShowOfferModal(true);
  };

  const handleOpenEditOffer = (off: OfferLetter) => {
    setEditingOffer(off);
    setOfferForm({
      candidate_name: off.candidate_name,
      candidate_email: off.candidate_email,
      candidate_phone: off.candidate_phone || '',
      candidate_address: off.candidate_address || '',
      employment_type: off.employment_type,
      position: off.position,
      department: off.department,
      reporting_to: off.reporting_to,
      joining_date: off.joining_date,
      work_location: off.work_location,
      laptop_required: !!off.laptop_required,
      work_mode: off.work_mode,
      working_days: off.working_days,
      working_hours: off.working_hours,
      monthly_salary: off.monthly_salary,
      annual_ctc: off.annual_ctc,
      payment_cycle: off.payment_cycle,
      salary_breakup:
        off.salary_breakup && off.salary_breakup.length > 0
          ? off.salary_breakup
          : [{ item: 'Basic Salary', monthly: off.monthly_salary, annual: off.annual_ctc }],
      clauses: off.clauses && off.clauses.length > 0 ? off.clauses : defaultClauses,
      signatory_name: off.signatory_name || 'Mr. Faizan Siddiqui',
      signatory_title: off.signatory_title || 'Business Head',
    });
    setShowOfferModal(true);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.candidate_name.trim() || !offerForm.candidate_email.trim()) {
      setError('Candidate Name and Email are required.');
      return;
    }

    setSavingDoc(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingOffer) {
        const res = await api.put<{ success: boolean; offer_letter: OfferLetter; message: string }>(
          `/payroll/offer-letters/${editingOffer.id}`,
          offerForm
        );
        setOffers((prev) =>
          prev.map((o) => (o.id === editingOffer.id ? res.offer_letter : o))
        );
        setSuccess(res.message || 'Offer Letter updated successfully!');
      } else {
        const res = await api.post<{ success: boolean; offer_letter: OfferLetter; message: string }>(
          '/payroll/offer-letters',
          offerForm
        );
        setOffers((prev) => [res.offer_letter, ...prev]);
        setSuccess(res.message || 'Offer Letter generated successfully!');
      }
      setShowOfferModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save offer letter.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteOffer = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to delete Offer Letter ${num}?`)) return;
    try {
      await api.delete(`/payroll/offer-letters/${id}`);
      setOffers((prev) => prev.filter((o) => o.id !== id));
      setSuccess(`Offer Letter ${num} removed.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete offer letter.');
    }
  };

  const handleSendOfferEmail = async (offer: OfferLetter) => {
    const hasPhone = Boolean(offer.candidate_phone);
    if (
      !window.confirm(
        `Dispatch official Offer Letter to ${offer.candidate_name}?\n` +
        `• Email: ${offer.candidate_email}\n` +
        (hasPhone ? `• WhatsApp: ${offer.candidate_phone}\n` : '') +
        `\nProceed with dispatch?`
      )
    ) {
      return;
    }
    setSendingEmailId(offer.id);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post<{ success: boolean; delivered: boolean; whatsapp_delivered?: boolean; message: string }>(
        `/payroll/offer-letters/${offer.id}/send-email`,
        {}
      );
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offer.id
            ? { ...o, status: 'SENT', sent_at: new Date().toISOString(), sent_to_email: offer.candidate_email }
            : o
        )
      );
      setSuccess(res.message || 'Offer Letter dispatched via WhatsApp and Email successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to send offer letter email.');
    } finally {
      setSendingEmailId(null);
    }
  };

  // Dynamic Clause Add/Remove in Offer Form
  const handleAddCustomClause = () => {
    const newClause: OfferClause = {
      id: 'custom_' + Date.now(),
      title: 'New Policy Clause',
      content: 'Enter the terms, stipulations, and requirements of this clause here.',
      is_default: false,
    };
    setOfferForm({ ...offerForm, clauses: [...offerForm.clauses, newClause] });
  };

  const handleRemoveClause = (idx: number) => {
    const updated = [...offerForm.clauses];
    updated.splice(idx, 1);
    setOfferForm({ ...offerForm, clauses: updated });
  };

  const handleClauseChange = (idx: number, field: 'title' | 'content', value: string) => {
    const updated = [...offerForm.clauses];
    updated[idx] = { ...updated[idx], [field]: value };
    setOfferForm({ ...offerForm, clauses: updated });
  };

  // Dynamic Salary Breakup in Offer Form
  const handleAddBreakupRow = () => {
    setOfferForm({
      ...offerForm,
      salary_breakup: [
        ...offerForm.salary_breakup,
        { item: 'Allowance / Bonus', monthly: 0, annual: 0 },
      ],
    });
  };

  const handleRemoveBreakupRow = (idx: number) => {
    const updated = [...offerForm.salary_breakup];
    updated.splice(idx, 1);
    setOfferForm({ ...offerForm, salary_breakup: updated });
  };

  const handleBreakupChange = (
    idx: number,
    field: 'item' | 'monthly' | 'annual',
    value: any
  ) => {
    const updated = [...offerForm.salary_breakup];
    if (field === 'monthly') {
      const mVal = parseFloat(value) || 0;
      updated[idx] = { ...updated[idx], monthly: mVal, annual: mVal * 12 };
    } else if (field === 'annual') {
      updated[idx] = { ...updated[idx], annual: parseFloat(value) || 0 };
    } else {
      updated[idx] = { ...updated[idx], item: value };
    }
    setOfferForm({ ...offerForm, salary_breakup: updated });
  };

  // --------------------------------------------------------------------------
  // Pay Slip Handlers
  // --------------------------------------------------------------------------
  const handleOpenCreateSlip = () => {
    setEditingSlip(null);
    setSlipForm({
      employee_name: '',
      employee_id: 'AM' + String(Date.now()).slice(-6),
      employee_email: '',
      employee_phone: '',
      designation: 'Web Developer',
      department: 'Tech',
      date_of_joining: '',
      month: currentMonthName,
      year: currentYearNum,
      total_working_days: 30,
      lop_days: 0,
      paid_days: 30,
      bank_name: 'HDFC BANK',
      bank_account_no: '',
      earnings: [
        { label: 'Basic Salary', amount: 25000 },
        { label: 'Travel Allowances', amount: 0 },
        { label: 'Incentive', amount: 0 },
      ],
      deductions: [
        { label: 'LOP Deduction', amount: 0 },
        { label: 'Professional Tax (PT)', amount: 0 },
      ],
      signatory_label: 'Employer Signature',
    });
    setShowSlipModal(true);
  };

  const handleOpenEditSlip = (sl: PaySlip) => {
    setEditingSlip(sl);
    setSlipForm({
      employee_name: sl.employee_name,
      employee_id: sl.employee_id,
      employee_email: sl.employee_email,
      employee_phone: sl.employee_phone || '',
      designation: sl.designation,
      department: sl.department,
      date_of_joining: sl.date_of_joining || '',
      month: sl.month,
      year: sl.year,
      total_working_days: sl.total_working_days,
      lop_days: sl.lop_days,
      paid_days: sl.paid_days,
      bank_name: sl.bank_name,
      bank_account_no: sl.bank_account_no || '',
      earnings: sl.earnings || [],
      deductions: sl.deductions || [],
      signatory_label: sl.signatory_label || 'Employer Signature',
    });
    setShowSlipModal(true);
  };

  const handleSelectStaffForSlip = (staffId: string) => {
    const selected = teamStaff.find((s) => s.id === staffId);
    if (!selected) return;
    setSlipForm({
      ...slipForm,
      employee_name: selected.name,
      employee_email: selected.email,
      employee_phone: (selected as any).phone || '',
      designation: selected.custom_role || (selected.role === 'developer' ? 'Web Developer' : selected.role),
      employee_id: 'AM' + selected.id.replace(/\D/g, '').slice(-6) || ('AM' + String(Date.now()).slice(-6)),
    });
  };

  // Earnings & Deductions dynamic rows
  const handleAddEarningRow = () => {
    setSlipForm({
      ...slipForm,
      earnings: [...slipForm.earnings, { label: 'New Allowance', amount: 0 }],
    });
  };

  const handleRemoveEarningRow = (idx: number) => {
    const updated = [...slipForm.earnings];
    updated.splice(idx, 1);
    setSlipForm({ ...slipForm, earnings: updated });
  };

  const handleEarningChange = (idx: number, field: 'label' | 'amount', value: any) => {
    const updated = [...slipForm.earnings];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'amount' ? parseFloat(value) || 0 : value,
    };
    setSlipForm({ ...slipForm, earnings: updated });
  };

  const handleAddDeductionRow = () => {
    setSlipForm({
      ...slipForm,
      deductions: [...slipForm.deductions, { label: 'New Deduction', amount: 0 }],
    });
  };

  const handleRemoveDeductionRow = (idx: number) => {
    const updated = [...slipForm.deductions];
    updated.splice(idx, 1);
    setSlipForm({ ...slipForm, deductions: updated });
  };

  const handleDeductionChange = (idx: number, field: 'label' | 'amount', value: any) => {
    const updated = [...slipForm.deductions];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'amount' ? parseFloat(value) || 0 : value,
    };
    setSlipForm({ ...slipForm, deductions: updated });
  };

  // Calculation of totals
  const totalEarnings = slipForm.earnings.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalDeductions = slipForm.deductions.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculatedNetPay = Math.max(0, totalEarnings - totalDeductions);
  const calculatedWords = convertRupeesToWords(calculatedNetPay);

  const handleSaveSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipForm.employee_name.trim() || !slipForm.employee_id.trim()) {
      setError('Employee Name and Employee ID are required.');
      return;
    }

    setSavingDoc(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingSlip) {
        const res = await api.put<{ success: boolean; pay_slip: PaySlip; message: string }>(
          `/payroll/pay-slips/${editingSlip.id}`,
          slipForm
        );
        setSlips((prev) =>
          prev.map((s) => (s.id === editingSlip.id ? res.pay_slip : s))
        );
        setSuccess(res.message || 'Salary Slip updated successfully!');
      } else {
        const res = await api.post<{ success: boolean; pay_slip: PaySlip; message: string }>(
          '/payroll/pay-slips',
          slipForm
        );
        setSlips((prev) => [res.pay_slip, ...prev]);
        setSuccess(res.message || 'Salary Slip generated successfully!');
      }
      setShowSlipModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save salary slip.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteSlip = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to delete Salary Slip ${num}?`)) return;
    try {
      await api.delete(`/payroll/pay-slips/${id}`);
      setSlips((prev) => prev.filter((s) => s.id !== id));
      setSuccess(`Salary Slip ${num} deleted.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete salary slip.');
    }
  };

  const handleSendSlipEmail = async (slip: PaySlip) => {
    const hasPhone = Boolean(slip.employee_phone);
    if (
      !window.confirm(
        `Dispatch official Salary Slip for ${slip.month} ${slip.year} to ${slip.employee_name}?\n` +
        `• Email: ${slip.employee_email}\n` +
        (hasPhone ? `• WhatsApp: ${slip.employee_phone}\n` : '') +
        `\nProceed with dispatch?`
      )
    ) {
      return;
    }
    setSendingEmailId(slip.id);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post<{ success: boolean; delivered: boolean; whatsapp_delivered?: boolean; message: string }>(
        `/payroll/pay-slips/${slip.id}/send-email`,
        {}
      );
      setSlips((prev) =>
        prev.map((s) =>
          s.id === slip.id
            ? { ...s, status: 'SENT', sent_at: new Date().toISOString(), sent_to_email: slip.employee_email }
            : s
        )
      );
      setSuccess(res.message || 'Salary Slip dispatched via WhatsApp and Email successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to send salary slip email.');
    } finally {
      setSendingEmailId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Filtered Lists
  // --------------------------------------------------------------------------
  const filteredOffers = offers.filter(
    (o) =>
      o.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.offer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.candidate_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSlips = slips.filter(
    (s) =>
      s.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slip_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.month.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#0176D3]/10 text-[#0176D3] uppercase tracking-wider">
              Assurance Media Studio
            </span>
            <span className="text-xs text-slate-400">&bull; Admin &amp; Payroll Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <FileSignature className="text-[#0176D3]" size={26} />
            Payroll &amp; Document Generator
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, customize, print, and securely email official <strong>Offer Letters</strong> and{' '}
            <strong>Salary Slips</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenCreateOffer}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0176D3] hover:bg-[#005bb5] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>Generate Offer Letter</span>
          </button>
          <button
            onClick={handleOpenCreateSlip}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>Generate Salary Slip</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-xs text-emerald-600 hover:text-emerald-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-600 hover:text-rose-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Search Navigation Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'offers'
                ? 'bg-[#0176D3] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={15} />
            <span>Offer Letters ({offers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('slips')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'slips'
                ? 'bg-[#0176D3] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard size={15} />
            <span>Salary Slips ({slips.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'offers' ? 'Search by candidate, position...' : 'Search by employee, ID, month...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3] focus:bg-white"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OFFER LETTERS LIST */}
      {/* ========================================================================= */}
      {activeTab === 'offers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Employment Contracts &amp; Offer Letters
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {filteredOffers.length} {filteredOffers.length === 1 ? 'Offer' : 'Offers'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading offer letters...</div>
          ) : filteredOffers.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              <FileText size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700">No offer letters generated yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Generate Offer Letter" above to create an official employment contract.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="py-3 px-5">Offer ID</th>
                    <th className="py-3 px-5">Candidate</th>
                    <th className="py-3 px-5">Position / Dept</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Monthly Salary</th>
                    <th className="py-3 px-5">Joining Date</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffers.map((off) => {
                    const empBadge =
                      off.employment_type === 'internship'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : off.employment_type === 'part_time'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200';

                    const empLabel =
                      off.employment_type === 'internship'
                        ? 'Internship'
                        : off.employment_type === 'part_time'
                        ? 'Part Time'
                        : 'Full Time';

                    return (
                      <tr key={off.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-[#0176D3]">
                          {off.offer_number}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-900">{off.candidate_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{off.candidate_email}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-medium text-slate-800">{off.position}</div>
                          <div className="text-[11px] text-slate-400">{off.department}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${empBadge}`}>
                            {empLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-800">
                          ₹{Number(off.monthly_salary).toLocaleString('en-IN')}/-
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">
                          {off.joining_date ? new Date(off.joining_date).toLocaleDateString('en-GB') : 'N/A'}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              off.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {off.status === 'SENT' ? 'SENT VIA EMAIL' : 'DRAFT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPreviewDoc({ type: 'offer', data: off })}
                              className="p-1.5 text-slate-600 hover:text-[#0176D3] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Live Preview & Print Document"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={() => handleOpenEditOffer(off)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Offer Letter"
                            >
                              <Edit2 size={15} />
                            </button>

                            <button
                              onClick={() => handleSendOfferEmail(off)}
                              disabled={sendingEmailId === off.id}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Send Offer Letter to Candidate via Email"
                            >
                              <Mail size={15} className={sendingEmailId === off.id ? 'animate-bounce' : ''} />
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteOffer(off.id, off.offer_number)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Offer Letter"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
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

      {/* ========================================================================= */}
      {/* TAB 2: SALARY SLIPS LIST */}
      {/* ========================================================================= */}
      {activeTab === 'slips' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Monthly Salary Slips (Payroll Records)
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {filteredSlips.length} {filteredSlips.length === 1 ? 'Slip' : 'Slips'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading salary slips...</div>
          ) : filteredSlips.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              <CreditCard size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700">No salary slips generated yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Generate Salary Slip" above to create an official employee pay slip.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="py-3 px-5">Slip ID</th>
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5">Emp ID</th>
                    <th className="py-3 px-5">Pay Period</th>
                    <th className="py-3 px-5">Paid Days</th>
                    <th className="py-3 px-5">Net Take-Home</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSlips.map((sl) => {
                    return (
                      <tr key={sl.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-emerald-700">
                          {sl.slip_number}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-900">{sl.employee_name}</div>
                          <div className="text-[11px] text-slate-400">{sl.designation} &bull; {sl.department}</div>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-600">
                          {sl.employee_id}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-800">
                          {sl.month} {sl.year}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-semibold text-emerald-700">{sl.paid_days} Days</span>
                          <span className="text-[10.5px] text-slate-400 ml-1">({sl.total_working_days} total)</span>
                        </td>
                        <td className="py-3.5 px-5 font-bold text-emerald-700 text-sm">
                          ₹{Number(sl.net_pay).toLocaleString('en-IN')}/-
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              sl.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sl.status === 'SENT' ? 'SENT VIA EMAIL' : 'GENERATED'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPreviewDoc({ type: 'slip', data: sl })}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Live Preview & Print Document"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={() => handleOpenEditSlip(sl)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Salary Slip"
                            >
                              <Edit2 size={15} />
                            </button>

                            <button
                              onClick={() => handleSendSlipEmail(sl)}
                              disabled={sendingEmailId === sl.id}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Send Salary Slip to Employee via Email"
                            >
                              <Mail size={15} className={sendingEmailId === sl.id ? 'animate-bounce' : ''} />
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteSlip(sl.id, sl.slip_number)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Salary Slip"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
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

      {/* ========================================================================= */}
      {/* MODAL 1: OFFER LETTER STUDIO (CUSTOMIZABLE) */}
      {/* ========================================================================= */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileSignature className="text-[#0176D3]" size={22} />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingOffer ? `Edit Offer Letter (${editingOffer.offer_number})` : 'Create Customizable Offer Letter'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Full customization of candidate details, employment terms, dynamic clauses, and salary breakup.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOfferModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveOffer} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* 1. Candidate Info */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 flex items-center gap-2">
                  <User size={13} className="text-[#0176D3]" /> Candidate Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vanshika Kondar"
                      value={offerForm.candidate_name}
                      onChange={(e) => setOfferForm({ ...offerForm, candidate_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="candidate@example.com"
                      value={offerForm.candidate_email}
                      onChange={(e) => setOfferForm({ ...offerForm, candidate_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={offerForm.candidate_phone}
                      onChange={(e) => setOfferForm({ ...offerForm, candidate_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Residential Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 204/Priya Arcade, Plot no 28, Sector 2A, Panvel - 410206"
                      value={offerForm.candidate_address}
                      onChange={(e) => setOfferForm({ ...offerForm, candidate_address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Employment Terms */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 flex items-center gap-2">
                  <Briefcase size={13} className="text-[#0176D3]" /> Employment Terms
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Employment Type *</label>
                    <select
                      value={offerForm.employment_type}
                      onChange={(e) => setOfferForm({ ...offerForm, employment_type: e.target.value as EmploymentType })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-white font-medium"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Position / Designation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Web Developer"
                      value={offerForm.position}
                      onChange={(e) => setOfferForm({ ...offerForm, position: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Tech"
                      value={offerForm.department}
                      onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Reporting To</label>
                    <input
                      type="text"
                      placeholder="Management Team / Director"
                      value={offerForm.reporting_to}
                      onChange={(e) => setOfferForm({ ...offerForm, reporting_to: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Joining Date *</label>
                    <input
                      type="date"
                      required
                      value={offerForm.joining_date}
                      onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Work Mode</label>
                    <input
                      type="text"
                      placeholder="On Site"
                      value={offerForm.work_mode}
                      onChange={(e) => setOfferForm({ ...offerForm, work_mode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Working Days &amp; Hours</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Monday to Saturday (Office)"
                        value={offerForm.working_days}
                        onChange={(e) => setOfferForm({ ...offerForm, working_days: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                      />
                      <input
                        type="text"
                        placeholder="10 AM – 6:30 PM"
                        value={offerForm.working_hours}
                        onChange={(e) => setOfferForm({ ...offerForm, working_hours: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Work Location &amp; Laptop</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Office Address"
                        value={offerForm.work_location}
                        onChange={(e) => setOfferForm({ ...offerForm, work_location: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                      />
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={offerForm.laptop_required}
                          onChange={(e) => setOfferForm({ ...offerForm, laptop_required: e.target.checked })}
                          className="rounded text-[#0176D3]"
                        />
                        <span>Laptop Required</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Compensation & Salary Breakup */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <DollarSign size={13} className="text-[#0176D3]" /> Compensation &amp; Salary Breakup
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddBreakupRow}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0176D3] hover:underline"
                  >
                    <Plus size={12} /> Add Component
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Fixed Monthly Salary (₹)</label>
                    <input
                      type="number"
                      value={offerForm.monthly_salary}
                      onChange={(e) => {
                        const mVal = parseFloat(e.target.value) || 0;
                        setOfferForm({
                          ...offerForm,
                          monthly_salary: mVal,
                          annual_ctc: mVal * 12,
                          salary_breakup: offerForm.salary_breakup.map((b, i) =>
                            i === 0 ? { ...b, monthly: mVal, annual: mVal * 12 } : b
                          ),
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3] font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Annual CTC (₹)</label>
                    <input
                      type="number"
                      value={offerForm.annual_ctc}
                      onChange={(e) => setOfferForm({ ...offerForm, annual_ctc: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3] font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Payment Cycle</label>
                    <input
                      type="text"
                      placeholder="Monthly (13th of Every Month)"
                      value={offerForm.payment_cycle}
                      onChange={(e) => setOfferForm({ ...offerForm, payment_cycle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                </div>

                {/* Breakup Rows */}
                <div className="space-y-2 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-600 uppercase">Custom Breakup Items</div>
                  {offerForm.salary_breakup.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Component Name (e.g. Basic Salary)"
                        value={row.item}
                        onChange={(e) => handleBreakupChange(idx, 'item', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Monthly (₹)"
                          value={row.monthly}
                          onChange={(e) => handleBreakupChange(idx, 'monthly', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-medium"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Annual (₹)"
                          value={row.annual}
                          onChange={(e) => handleBreakupChange(idx, 'annual', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-medium"
                        />
                      </div>
                      {offerForm.salary_breakup.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakupRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Remove Component"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Dynamic Clauses (Add / Edit / Delete) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Shield size={13} className="text-[#0176D3]" /> Clauses &amp; Legal Terms ({offerForm.clauses.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddCustomClause}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0176D3] hover:underline"
                  >
                    <Plus size={12} /> Add Custom Clause
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {offerForm.clauses.map((clause, idx) => (
                    <div key={clause.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={clause.title}
                          onChange={(e) => handleClauseChange(idx, 'title', e.target.value)}
                          className="font-bold text-slate-800 text-xs px-2.5 py-1 border border-slate-300 rounded-md bg-white w-2/3"
                          placeholder="Clause Title"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveClause(idx)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={clause.content}
                        onChange={(e) => handleClauseChange(idx, 'content', e.target.value)}
                        className="w-full text-[11.5px] p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#0176D3] leading-relaxed"
                        placeholder="Clause description and obligations..."
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Signatory */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  Authorized Signatory
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Partner / Authority Name</label>
                    <input
                      type="text"
                      value={offerForm.signatory_name}
                      onChange={(e) => setOfferForm({ ...offerForm, signatory_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                    <input
                      type="text"
                      value={offerForm.signatory_title}
                      onChange={(e) => setOfferForm({ ...offerForm, signatory_title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="px-5 py-2 bg-[#0176D3] hover:bg-[#005bb5] text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <FileSignature size={15} />
                  <span>{savingDoc ? 'Saving...' : editingOffer ? 'Update Offer Letter' : 'Generate Offer Letter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SALARY SLIP STUDIO (CUSTOMIZABLE) */}
      {/* ========================================================================= */}
      {showSlipModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <CreditCard className="text-emerald-600" size={22} />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingSlip ? `Edit Salary Slip (${editingSlip.slip_number})` : 'Generate Customizable Salary Slip'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Matches official Assurance Media layout with dynamic earnings, deductions, and automatic number-to-words.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSlipModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSlip} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Autofill from Team Roster */}
              {teamStaff.length > 0 && !editingSlip && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-emerald-600 flex-shrink-0" size={16} />
                    <span className="font-semibold text-emerald-950">Quick-Fill from Active Team Member:</span>
                  </div>
                  <select
                    onChange={(e) => handleSelectStaffForSlip(e.target.value)}
                    defaultValue=""
                    className="px-3 py-1.5 border border-emerald-300 rounded-lg text-xs bg-white font-medium focus:outline-none"
                  >
                    <option value="" disabled>
                      Select an existing staff member...
                    </option>
                    {teamStaff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 1. Employee Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 flex items-center gap-2">
                  <User size={13} className="text-emerald-600" /> Employee Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Employee Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Akash Mahendra Maurya"
                      value={slipForm.employee_name}
                      onChange={(e) => setSlipForm({ ...slipForm, employee_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Employee ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AM050926"
                      value={slipForm.employee_id}
                      onChange={(e) => setSlipForm({ ...slipForm, employee_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="employee@assurancemedia.in"
                      value={slipForm.employee_email}
                      onChange={(e) => setSlipForm({ ...slipForm, employee_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">WhatsApp Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 8369406363"
                      value={slipForm.employee_phone}
                      onChange={(e) => setSlipForm({ ...slipForm, employee_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Designation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Web Developer"
                      value={slipForm.designation}
                      onChange={(e) => setSlipForm({ ...slipForm, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="Tech"
                      value={slipForm.department}
                      onChange={(e) => setSlipForm({ ...slipForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Date of Joining</label>
                    <input
                      type="date"
                      value={slipForm.date_of_joining}
                      onChange={(e) => setSlipForm({ ...slipForm, date_of_joining: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="HDFC BANK"
                      value={slipForm.bank_name}
                      onChange={(e) => setSlipForm({ ...slipForm, bank_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 50100898870968"
                      value={slipForm.bank_account_no}
                      onChange={(e) => setSlipForm({ ...slipForm, bank_account_no: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Attendance & Cycle */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 flex items-center gap-2">
                  <Calendar size={13} className="text-emerald-600" /> Pay Cycle &amp; Attendance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Month *</label>
                    <select
                      value={slipForm.month}
                      onChange={(e) => setSlipForm({ ...slipForm, month: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Year *</label>
                    <input
                      type="number"
                      value={slipForm.year}
                      onChange={(e) => setSlipForm({ ...slipForm, year: parseInt(e.target.value) || 2026 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Total Days</label>
                    <input
                      type="number"
                      value={slipForm.total_working_days}
                      onChange={(e) => {
                        const tot = parseInt(e.target.value) || 30;
                        setSlipForm({
                          ...slipForm,
                          total_working_days: tot,
                          paid_days: Math.max(0, tot - slipForm.lop_days),
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">LOP Days</label>
                    <input
                      type="number"
                      value={slipForm.lop_days}
                      onChange={(e) => {
                        const lop = parseInt(e.target.value) || 0;
                        setSlipForm({
                          ...slipForm,
                          lop_days: lop,
                          paid_days: Math.max(0, slipForm.total_working_days - lop),
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-rose-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Paid Days</label>
                    <input
                      type="number"
                      value={slipForm.paid_days}
                      onChange={(e) => setSlipForm({ ...slipForm, paid_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-emerald-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="space-y-2.5 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-200">
                    <span className="font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
                      Earnings Breakdown
                    </span>
                    <button
                      type="button"
                      onClick={handleAddEarningRow}
                      className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {slipForm.earnings.map((eRow, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Label (e.g. Basic Salary)"
                          value={eRow.label}
                          onChange={(e) => handleEarningChange(idx, 'label', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                        />
                        <div className="w-28">
                          <input
                            type="number"
                            placeholder="₹ Amount"
                            value={eRow.amount}
                            onChange={(e) => handleEarningChange(idx, 'amount', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-medium"
                          />
                        </div>
                        {slipForm.earnings.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEarningRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between font-bold text-emerald-950">
                    <span>Total Earnings:</span>
                    <span>₹{totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2.5 bg-rose-50/40 p-4 rounded-xl border border-rose-200">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-200">
                    <span className="font-bold text-rose-900 uppercase tracking-wider text-[11px]">
                      Deductions Breakdown
                    </span>
                    <button
                      type="button"
                      onClick={handleAddDeductionRow}
                      className="text-rose-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {slipForm.deductions.map((dRow, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Label (e.g. LOP Deduction)"
                          value={dRow.label}
                          onChange={(e) => handleDeductionChange(idx, 'label', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                        />
                        <div className="w-28">
                          <input
                            type="number"
                            placeholder="₹ Amount"
                            value={dRow.amount}
                            onChange={(e) => handleDeductionChange(idx, 'amount', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-medium text-rose-700"
                          />
                        </div>
                        {slipForm.deductions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDeductionRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-rose-200 flex items-center justify-between font-bold text-rose-950">
                    <span>Total Deductions:</span>
                    <span>₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Realtime Net Pay & Words Banner */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Computed Net Take Home Pay
                  </div>
                  <div className="text-xs text-emerald-900 font-medium italic mt-0.5">
                    In Words: <strong>{calculatedWords}</strong>
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-800">
                  ₹ {calculatedNetPay.toLocaleString('en-IN')}/-
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSlipModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <CreditCard size={15} />
                  <span>{savingDoc ? 'Saving...' : editingSlip ? 'Update Salary Slip' : 'Generate Salary Slip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: HIGH-FIDELITY LIVE PREVIEW & PRINT MODAL */}
      {/* ========================================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Action Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="text-[#0176D3]" size={18} />
                <span className="font-bold text-sm">
                  {previewDoc.type === 'offer'
                    ? `Offer Letter Preview (${(previewDoc.data as OfferLetter).offer_number})`
                    : `Salary Slip Preview (${(previewDoc.data as PaySlip).slip_number})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/payroll/view/${previewDoc.type === 'offer' ? 'offer' : 'payslip'}/${previewDoc.data.view_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  <ExternalLink size={13} />
                  <span>Open Fullscreen</span>
                </a>
                <button
                  onClick={() => {
                    const url = `/api/payroll/view/${previewDoc.type === 'offer' ? 'offer' : 'payslip'}/${previewDoc.data.view_token}`;
                    const printWin = window.open(url, '_blank');
                    if (printWin) {
                      printWin.focus();
                      setTimeout(() => printWin.print(), 800);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#005bb5] text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  <Printer size={13} />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Embedded Live Web Preview */}
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-200">
              <iframe
                title="Document View"
                src={`/api/payroll/view/${previewDoc.type === 'offer' ? 'offer' : 'payslip'}/${previewDoc.data.view_token}`}
                className="w-full h-[78vh] bg-white rounded-lg shadow-md border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
