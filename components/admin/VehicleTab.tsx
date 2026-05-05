'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import {
  subscribeVehicles, subscribeVehicleExpenses,
  addVehicle, updateVehicle, deleteVehicle,
  addVehicleExpense, updateVehicleExpense, deleteVehicleExpense,
} from '@/lib/firebase/firestore';
import { Vehicle, VehicleExpense } from '@/lib/types/inventory';
import ImageUploader from '@/components/admin/ImageUploader';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_TYPES = ['Oil Change', 'Fuel', 'Tires', 'Repair', 'Registration', 'Other'] as const;
type ExpenseType = typeof EXPENSE_TYPES[number];

const VEHICLE_TYPES = ['Van', 'Sedan', 'SUV', 'Truck', 'Motorcycle', 'Other'];

const TYPE_COLORS: Record<ExpenseType, { bg: string; text: string; dot: string }> = {
  'Oil Change':   { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
  'Fuel':         { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  'Tires':        { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500'  },
  'Repair':       { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
  'Registration': { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  'Other':        { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
};

const PER_PAGE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return '₱' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '₱' + (n / 1_000).toFixed(1) + 'k';
  return fmt(n);
}

function monthKey(dateStr: string) {
  // dateStr = YYYY-MM-DD
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

function TypeBadge({ type }: { type: ExpenseType }) {
  const c = TYPE_COLORS[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {type}
    </span>
  );
}

// ── Mini bar chart for expense breakdown ──────────────────────────────────────
function BreakdownBar({ expenses }: { expenses: VehicleExpense[] }) {
  const total = expenses.reduce((s, e) => s + e.cost, 0);
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-4">No expenses yet.</p>;

  const byType = EXPENSE_TYPES.map(t => ({
    type: t,
    amount: expenses.filter(e => e.expenseType === t).reduce((s, e) => s + e.cost, 0),
  })).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-2.5">
      {byType.map(({ type, amount }) => {
        const pct = (amount / total) * 100;
        const c = TYPE_COLORS[type as ExpenseType];
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">{type}</span>
              <span className="text-xs text-gray-500">{fmtShort(amount)} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.dot}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly trend (simple bar chart) ─────────────────────────────────────────
function MonthlyTrend({ expenses }: { expenses: VehicleExpense[] }) {
  const months = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const k = e.date.slice(0, 7); // YYYY-MM
      map[k] = (map[k] || 0) + e.cost;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({
        label: new Date(k + '-01').toLocaleString('en-PH', { month: 'short', year: '2-digit' }),
        value: v,
      }));
  }, [expenses]);

  if (months.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>;

  const max = Math.max(...months.map(m => m.value));

  return (
    <div className="flex items-end gap-2 h-28">
      {months.map(m => (
        <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">{fmtShort(m.value)}</span>
          <div className="w-full bg-gray-100 rounded-t-md overflow-hidden" style={{ height: 72 }}>
            <div
              className="w-full bg-purple-500 rounded-t-md transition-all duration-500"
              style={{ height: `${max > 0 ? (m.value / max) * 100 : 0}%`, marginTop: 'auto' }}
            />
          </div>
          <span className="text-xs text-gray-400">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle, expenses, selected, onSelect, onEdit, onDelete,
}: {
  vehicle: Vehicle;
  expenses: VehicleExpense[];
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const total = expenses.reduce((s, e) => s + e.cost, 0);
  const lastExp = expenses[0];

  return (
    <div
      onClick={onSelect}
      className={`card p-5 cursor-pointer transition-all hover:shadow-md
        ${selected ? 'ring-2 ring-purple-500 border-purple-200' : 'hover:border-gray-300'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Vehicle icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${selected ? 'bg-purple-700' : 'bg-gray-100'}`}>
            <svg className={`w-5 h-5 ${selected ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8 17l-1.5-5.5L5 10h14l-1.5 1.5L16 17M3 17h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M9 17v1m6-1v1"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{vehicle.name}</p>
            <p className="text-xs text-gray-500 font-mono">{vehicle.plateNumber}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-50 rounded-lg px-2.5 py-2">
          <p className="text-gray-400 mb-0.5">Type / Year</p>
          <p className="font-medium text-gray-700">{vehicle.type} • {vehicle.year}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-2.5 py-2">
          <p className="text-gray-400 mb-0.5">Driver</p>
          <p className="font-medium text-gray-700 truncate">{vehicle.assignedDriver || '—'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-400">Total Expenses</p>
          <p className="text-lg font-bold text-purple-700">{fmtShort(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Last Service</p>
          <p className="text-xs font-medium text-gray-600">{lastExp ? lastExp.date : '—'}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle Form Modal ───────────────────────────────────────────────────────
type VehicleFormData = Omit<Vehicle, 'id' | 'createdAt'>;
const EMPTY_VEHICLE: VehicleFormData = { name: '', plateNumber: '', type: 'Van', year: '', assignedDriver: '', notes: '' };

function VehicleModal({
  mode, initial, onSave, onClose, saving, error,
}: {
  mode: 'add' | 'edit';
  initial: VehicleFormData;
  onSave: (d: VehicleFormData) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<VehicleFormData>(initial);
  const upd = (k: keyof VehicleFormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">{mode === 'add' ? 'Add Vehicle' : 'Edit Vehicle'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => upd('name', e.target.value)}
                placeholder="e.g. L300 Van" className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.plateNumber} onChange={e => upd('plateNumber', e.target.value.toUpperCase())}
                placeholder="e.g. ABC 1234" className="input-base font-mono"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => upd('type', e.target.value)} className="input-base bg-white">
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="text" value={form.year} onChange={e => upd('year', e.target.value)}
                placeholder="e.g. 2019" className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Driver</label>
              <input type="text" value={form.assignedDriver} onChange={e => upd('assignedDriver', e.target.value)}
                placeholder="e.g. Juan dela Cruz" className="input-base"/>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2}
                placeholder="Any notes..." className="input-base resize-none"/>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave(form)}
            disabled={saving || !form.name.trim() || !form.plateNumber.trim()}
            className="btn-primary flex-1 py-2.5">
            {saving ? <><Spinner sm/> Saving...</> : mode === 'add' ? 'Add Vehicle' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Expense Form Modal ───────────────────────────────────────────────────────
type ExpenseFormData = Omit<VehicleExpense, 'id' | 'createdAt'>;

function ExpenseModal({
  mode, initial, vehicles, onSave, onClose, saving, error,
}: {
  mode: 'add' | 'edit';
  initial: ExpenseFormData;
  vehicles: Vehicle[];
  onSave: (d: ExpenseFormData) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<ExpenseFormData>(initial);
  const upd = (k: keyof ExpenseFormData, v: any) => setForm(p => ({ ...p, [k]: v }));

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">{mode === 'add' ? 'Log Expense' : 'Edit Expense'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle <span className="text-red-500">*</span></label>
            <select value={form.vehicleId}
              onChange={e => {
                const v = vehicles.find(x => x.id === e.target.value);
                upd('vehicleId', e.target.value);
                if (v) upd('vehicleName', v.name);
              }}
              className="input-base bg-white">
              <option value="">Select vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} — {v.plateNumber}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => upd('date', e.target.value)} className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type <span className="text-red-500">*</span></label>
              <select value={form.expenseType} onChange={e => upd('expenseType', e.target.value as ExpenseType)} className="input-base bg-white">
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₱) <span className="text-red-500">*</span></label>
              <input type="number" min={0} step={0.01} value={form.cost || ''}
                onChange={e => upd('cost', parseFloat(e.target.value) || 0)}
                placeholder="0.00" className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer Reading</label>
              <input type="text" value={form.odometer} onChange={e => upd('odometer', e.target.value)}
                placeholder="e.g. 54,200 km" className="input-base"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Shop</label>
            <input type="text" value={form.vendor} onChange={e => upd('vendor', e.target.value)}
              placeholder="e.g. Toyota Service Center" className="input-base"/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2}
              placeholder="Details about this expense..." className="input-base resize-none"/>
          </div>

          <ImageUploader
            folder="receipts"
            currentUrl={form.receiptPhotoUrl}
            onUploaded={url => upd('receiptPhotoUrl', url)}
            onRemove={() => upd('receiptPhotoUrl', null)}
            label="Receipt Photo"
            optional={true}
            hint="Upload a photo of the receipt or invoice."
            compact={true}
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave(form)}
            disabled={saving || !form.vehicleId || !form.date || form.cost <= 0}
            className="btn-primary flex-1 py-2.5">
            {saving ? <><Spinner sm/> Saving...</> : mode === 'add' ? 'Log Expense' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main VehicleTab ──────────────────────────────────────────────────────────

type SubView = 'overview' | 'expenses' | 'reports';

export default function VehicleTab() {
  const { user } = useAuth();
  const adminName = user?.displayName || user?.email || 'Admin';

  // Data
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [expenses, setExpenses]   = useState<VehicleExpense[]>([]);
  const [loadingV, setLoadingV]   = useState(true);
  const [loadingE, setLoadingE]   = useState(true);

  // UI state
  const [subView, setSubView]         = useState<SubView>('overview');
  const [selectedVId, setSelectedVId] = useState<string | null>(null);
  const [page, setPage]               = useState(1);

  // Filters
  const [filterType, setFilterType]   = useState<string>('All');
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');
  const [searchQ, setSearchQ]         = useState('');

  // Vehicle modal
  const [vModal, setVModal]           = useState<'add' | 'edit' | null>(null);
  const [vForm, setVForm]             = useState<VehicleFormData>({ ...EMPTY_VEHICLE });
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [savingV, setSavingV]         = useState(false);
  const [errV, setErrV]               = useState<string | null>(null);

  // Expense modal
  const [eModal, setEModal]           = useState<'add' | 'edit' | null>(null);
  const [eForm, setEForm]             = useState<ExpenseFormData | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [savingE, setSavingE]         = useState(false);
  const [errE, setErrE]               = useState<string | null>(null);

  // Delete confirms
  const [delVehicle, setDelVehicle]   = useState<Vehicle | null>(null);
  const [delExpense, setDelExpense]   = useState<VehicleExpense | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [delErr, setDelErr]           = useState<string | null>(null);

  // Receipt lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Subscriptions
  useEffect(() => {
    const unsub = subscribeVehicles(v => { setVehicles(v); setLoadingV(false); });
    return unsub;
  }, []);

  useEffect(() => {
    setLoadingE(true);
    const unsub = subscribeVehicleExpenses(null, e => { setExpenses(e); setLoadingE(false); });
    return unsub;
  }, []);

  // Derived data
  const selectedVehicle = vehicles.find(v => v.id === selectedVId) ?? null;

  const expensesForVehicle = (vid: string) => expenses.filter(e => e.vehicleId === vid);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchV = !selectedVId || e.vehicleId === selectedVId;
      const matchT = filterType === 'All' || e.expenseType === filterType;
      const matchF = !filterFrom || e.date >= filterFrom;
      const matchTo2 = !filterTo || e.date <= filterTo;
      const q = searchQ.toLowerCase();
      const matchQ = !q || e.vehicleName.toLowerCase().includes(q)
        || e.vendor.toLowerCase().includes(q)
        || e.expenseType.toLowerCase().includes(q)
        || e.notes.toLowerCase().includes(q);
      return matchV && matchT && matchF && matchTo2 && matchQ;
    });
  }, [expenses, selectedVId, filterType, filterFrom, filterTo, searchQ]);

  const totalPages = Math.ceil(filteredExpenses.length / PER_PAGE);
  const paginated  = filteredExpenses.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Totals for reports
  const reportExpenses = selectedVId ? expenses.filter(e => e.vehicleId === selectedVId) : expenses;
  const grandTotal = reportExpenses.reduce((s, e) => s + e.cost, 0);

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    reportExpenses.forEach(e => {
      const k = monthKey(e.date);
      map[k] = (map[k] || 0) + e.cost;
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  }, [reportExpenses]);

  // ── Vehicle CRUD ──────────────────────────────────────────────────────────

  function openAddVehicle() {
    setVForm({ ...EMPTY_VEHICLE }); setEditVehicleId(null); setErrV(null); setVModal('add');
  }

  function openEditVehicle(v: Vehicle) {
    setVForm({ name: v.name, plateNumber: v.plateNumber, type: v.type, year: v.year,
      assignedDriver: v.assignedDriver, notes: v.notes });
    setEditVehicleId(v.id); setErrV(null); setVModal('edit');
  }

  async function handleSaveVehicle(form: VehicleFormData) {
    setSavingV(true); setErrV(null);
    try {
      if (vModal === 'add') {
        await addVehicle(form, adminName);
      } else if (editVehicleId) {
        await updateVehicle(editVehicleId, form, adminName);
      }
      setVModal(null);
    } catch { setErrV('Failed to save. Please try again.'); }
    finally { setSavingV(false); }
  }

  async function handleDeleteVehicle() {
    if (!delVehicle) return;
    setDeleting(true); setDelErr(null);
    try {
      await deleteVehicle(delVehicle.id, delVehicle.name, adminName);
      if (selectedVId === delVehicle.id) setSelectedVId(null);
      setDelVehicle(null);
    } catch { setDelErr('Failed to delete.'); }
    finally { setDeleting(false); }
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  function openAddExpense() {
    const preselect = selectedVehicle ?? vehicles[0] ?? null;
    setEForm({
      vehicleId: preselect?.id ?? '',
      vehicleName: preselect?.name ?? '',
      date: today,
      expenseType: 'Oil Change',
      cost: 0,
      odometer: '',
      vendor: '',
      notes: '',
      receiptPhotoUrl: null,
    });
    setEditExpenseId(null); setErrE(null); setEModal('add');
  }

  function openEditExpense(e: VehicleExpense) {
    setEForm({
      vehicleId: e.vehicleId, vehicleName: e.vehicleName, date: e.date,
      expenseType: e.expenseType, cost: e.cost, odometer: e.odometer,
      vendor: e.vendor, notes: e.notes, receiptPhotoUrl: e.receiptPhotoUrl,
    });
    setEditExpenseId(e.id); setErrE(null); setEModal('edit');
  }

  async function handleSaveExpense(form: ExpenseFormData) {
    setSavingE(true); setErrE(null);
    try {
      if (eModal === 'add') {
        await addVehicleExpense(form, adminName);
      } else if (editExpenseId) {
        await updateVehicleExpense(editExpenseId, form, adminName);
      }
      setEModal(null);
    } catch { setErrE('Failed to save. Please try again.'); }
    finally { setSavingE(false); }
  }

  async function handleDeleteExpense() {
    if (!delExpense) return;
    setDeleting(true); setDelErr(null);
    try {
      await deleteVehicleExpense(delExpense.id, delExpense.vehicleName, delExpense.expenseType, adminName);
      setDelExpense(null);
    } catch { setDelErr('Failed to delete.'); }
    finally { setDeleting(false); }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Date','Vehicle','Plate','Expense Type','Cost (₱)','Odometer','Vendor','Notes'];
    const rows = filteredExpenses.map(e => {
      const v = vehicles.find(x => x.id === e.vehicleId);
      return [e.date, e.vehicleName, v?.plateNumber || '', e.expenseType,
        e.cost.toFixed(2), e.odometer, e.vendor, e.notes];
    });
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vehicle-expenses-${today}.csv`;
    a.click();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const loading = loadingV || loadingE;

  return (
    <div className="max-w-6xl space-y-4">

      {/* ── Sub-nav ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['overview', 'expenses', 'reports'] as SubView[]).map(v => (
            <button key={v} onClick={() => setSubView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition
                ${subView === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {v === 'overview' ? '🚗 Vehicles' : v === 'expenses' ? '📋 Expenses' : '📊 Reports'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {subView === 'overview' && (
            <button onClick={openAddVehicle} className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Vehicle
            </button>
          )}
          {subView === 'expenses' && (
            <>
              <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Export CSV
              </button>
              <button onClick={openAddExpense} className="btn-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Log Expense
              </button>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          OVERVIEW
      ════════════════════════════════════════════════════════════ */}
      {subView === 'overview' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
              <Spinner/><span className="text-sm">Loading...</span>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 17l-1.5-5.5L5 10h14l-1.5 1.5L16 17M3 17h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M9 17v1m6-1v1"/>
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-1">No vehicles yet</p>
              <p className="text-sm text-gray-400 mb-4">Add your first vehicle to start tracking expenses.</p>
              <button onClick={openAddVehicle} className="btn-primary mx-auto">Add Vehicle</button>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Vehicles', value: vehicles.length, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                  { label: 'Total Expenses (All)', value: fmtShort(expenses.reduce((s,e)=>s+e.cost,0)), color: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { label: 'This Month', value: fmtShort(expenses.filter(e => e.date.startsWith(today.slice(0,7))).reduce((s,e)=>s+e.cost,0)), color: 'text-green-700 bg-green-50 border-green-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                    <p className="text-sm font-medium opacity-80">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Vehicle cards */}
              <div className="grid grid-cols-2 gap-4">
                {vehicles.map(v => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    expenses={expensesForVehicle(v.id)}
                    selected={selectedVId === v.id}
                    onSelect={() => {
                      setSelectedVId(p => p === v.id ? null : v.id);
                      setSubView('expenses');
                    }}
                    onEdit={() => openEditVehicle(v)}
                    onDelete={() => { setDelVehicle(v); setDelErr(null); }}
                  />
                ))}
              </div>

              {/* Recent expenses */}
              {expenses.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Recent Expenses</h3>
                    <button onClick={() => setSubView('expenses')} className="text-sm text-purple-700 font-medium hover:underline">View all →</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Date','Vehicle','Type','Cost','Vendor'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.slice(0, 5).map(e => (
                          <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{e.date}</td>
                            <td className="px-5 py-3.5 font-medium text-gray-800">{e.vehicleName}</td>
                            <td className="px-5 py-3.5"><TypeBadge type={e.expenseType as ExpenseType}/></td>
                            <td className="px-5 py-3.5 font-semibold text-gray-800">{fmt(e.cost)}</td>
                            <td className="px-5 py-3.5 text-gray-600">{e.vendor || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          EXPENSES LOG
      ════════════════════════════════════════════════════════════ */}
      {subView === 'expenses' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card px-5 py-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input type="text" placeholder="Vehicle, vendor, notes..."
                  value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1); }}
                  className="input-base"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select value={selectedVId || ''} onChange={e => { setSelectedVId(e.target.value || null); setPage(1); }}
                  className="input-base bg-white w-auto">
                  <option value="">All Vehicles</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  className="input-base bg-white w-auto">
                  <option value="All">All Types</option>
                  {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
                  className="input-base w-auto"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }}
                  className="input-base w-auto"/>
              </div>
              {(searchQ || filterType !== 'All' || filterFrom || filterTo || selectedVId) && (
                <button onClick={() => { setSearchQ(''); setFilterType('All'); setFilterFrom(''); setFilterTo(''); setSelectedVId(null); setPage(1); }}
                  className="btn-secondary">Clear</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Expense Log
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {filteredExpenses.length} records
                </span>
              </h3>
              <span className="text-sm font-semibold text-purple-700">
                Total: {fmt(filteredExpenses.reduce((s, e) => s + e.cost, 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Date','Vehicle','Type','Cost','Odometer','Vendor','Notes','Receipt','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400"><Spinner/><span className="text-sm">Loading...</span></div>
                    </td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-gray-500 py-12 text-sm">No expenses found.</td></tr>
                  ) : paginated.map(e => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{e.date}</td>
                      <td className="px-5 py-4 font-medium text-gray-800">{e.vehicleName}</td>
                      <td className="px-5 py-4"><TypeBadge type={e.expenseType as ExpenseType}/></td>
                      <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">{fmt(e.cost)}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs">{e.odometer || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{e.vendor || '—'}</td>
                      <td className="px-5 py-4 text-gray-500 max-w-[160px]">
                        <p className="truncate text-xs">{e.notes || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        {e.receiptPhotoUrl
                          ? <img src={e.receiptPhotoUrl} alt="Receipt"
                              onClick={() => setLightboxUrl(e.receiptPhotoUrl)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"/>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditExpense(e)} title="Edit"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                          <button onClick={() => { setDelExpense(e); setDelErr(null); }} title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filteredExpenses.length)} of {filteredExpenses.length}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition
                        ${p === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          REPORTS
      ════════════════════════════════════════════════════════════ */}
      {subView === 'reports' && (
        <div className="space-y-4">
          {/* Vehicle filter */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter by vehicle:</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedVId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                  ${!selectedVId ? 'bg-purple-700 text-white border-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                All Vehicles
              </button>
              {vehicles.map(v => (
                <button key={v.id} onClick={() => setSelectedVId(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                    ${selectedVId === v.id ? 'bg-purple-700 text-white border-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Grand Total</p>
              <p className="text-2xl font-bold text-purple-700">{fmt(grandTotal)}</p>
              <p className="text-xs text-gray-400 mt-1">{reportExpenses.length} expense records</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">This Month</p>
              <p className="text-2xl font-bold text-blue-700">
                {fmt(reportExpenses.filter(e => e.date.startsWith(today.slice(0, 7))).reduce((s, e) => s + e.cost, 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">{today.slice(0, 7)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Avg per Month</p>
              <p className="text-2xl font-bold text-green-700">
                {monthlyTotals.length > 0 ? fmt(grandTotal / monthlyTotals.length) : '₱0.00'}
              </p>
              <p className="text-xs text-gray-400 mt-1">over {monthlyTotals.length} month{monthlyTotals.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Breakdown by type */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Breakdown by Type</h3>
              <BreakdownBar expenses={reportExpenses}/>
            </div>

            {/* Monthly trend */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Trend (Last 6 Months)</h3>
              <MonthlyTrend expenses={reportExpenses}/>
            </div>
          </div>

          {/* Per-vehicle comparison (only when All selected) */}
          {!selectedVId && vehicles.length > 1 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Per-Vehicle Comparison</h3>
              <div className="space-y-3">
                {vehicles.map(v => {
                  const vtotal = expensesForVehicle(v.id).reduce((s, e) => s + e.cost, 0);
                  const pct = grandTotal > 0 ? (vtotal / grandTotal) * 100 : 0;
                  return (
                    <div key={v.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{v.name}</span>
                          <span className="text-xs text-gray-400 ml-2 font-mono">{v.plateNumber}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{fmt(vtotal)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly breakdown table */}
          {monthlyTotals.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Monthly Cost Summary</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Month</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Total Spent</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTotals.map(([month, total]) => (
                    <tr key={month} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-800">{month}</td>
                      <td className="px-6 py-4 font-semibold text-purple-700">{fmt(total)}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {reportExpenses.filter(e => monthKey(e.date) === month).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Vehicle Modal ── */}
      {vModal && (
        <VehicleModal
          mode={vModal} initial={vForm}
          onSave={handleSaveVehicle} onClose={() => setVModal(null)}
          saving={savingV} error={errV}
        />
      )}

      {/* ── Expense Modal ── */}
      {eModal && eForm && (
        <ExpenseModal
          mode={eModal} initial={eForm} vehicles={vehicles}
          onSave={handleSaveExpense} onClose={() => setEModal(null)}
          saving={savingE} error={errE}
        />
      )}

      {/* ── Delete Vehicle Confirm ── */}
      {delVehicle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Vehicle?</h3>
            <p className="text-sm text-gray-600 mb-1 font-medium">"{delVehicle.name}"</p>
            <p className="text-sm text-gray-500 mb-4">Expense records for this vehicle will remain but become unlinked.</p>
            {delErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{delErr}</div>}
            <div className="flex gap-3">
              <button onClick={() => setDelVehicle(null)} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteVehicle} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <><Spinner sm/> Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Expense Confirm ── */}
      {delExpense && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Expense?</h3>
            <p className="text-sm text-gray-600 mb-1 font-medium">{delExpense.expenseType} — {fmt(delExpense.cost)}</p>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            {delErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{delErr}</div>}
            <div className="flex gap-3">
              <button onClick={() => setDelExpense(null)} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteExpense} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <><Spinner sm/> Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Receipt" className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"/>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}