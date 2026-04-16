'use client';
import { useState, useEffect } from 'react';
import { BorrowRequest } from '@/lib/types/inventory';
import { subscribeReturnedBorrows } from '@/lib/firebase/firestore';

const PER_PAGE = 8;

const tsToDate = (ts: any): Date =>
  ts?.toDate ? ts.toDate() : new Date(ts);

const fmtDate = (ts: any) => ts ? tsToDate(ts).toISOString().split('T')[0] : '—';

const monthLabel = (ts: any) => ts
  ? tsToDate(ts).toLocaleString('default', { month: 'long', year: 'numeric' })
  : '';

const condBadge = (c: string|null) => {
  if (!c) return <span className="text-gray-400">—</span>;
  const m: Record<string,string> = { Good:'bg-green-100 text-green-700', Fair:'bg-yellow-100 text-yellow-700', Damaged:'bg-red-100 text-red-700' };
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${m[c]||'bg-gray-100 text-gray-700'}`}>{c}</span>;
};

function Spinner() {
  return <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>;
}

export default function ReturnedTab() {
  const [all, setAll]           = useState<BorrowRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [monthFilter, setMonth] = useState('All');
  const [page, setPage]         = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [lightboxImg, setLightboxImg]     = useState<string|null>(null);

  useEffect(() => {
    return subscribeReturnedBorrows(data => { setAll(data); setLoading(false); });
  }, []);

  const months = ['All', ...Array.from(new Set(
    all.filter(r => r.returnedAt).map(r => monthLabel(r.returnedAt))
  ))];

  const filtered = monthFilter === 'All' ? all
    : all.filter(r => r.returnedAt && monthLabel(r.returnedAt) === monthFilter);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  function exportCSV() {
    const headers = ['Ref ID','Borrower','Department','Contact','Items','Inventory No.','Serial No.','Borrow Date','Due Date','Returned At','Condition','Notes'];
    const rows = filtered.map(r => [
      r.id, r.borrowerName, r.borrowerDepartment, r.borrowerContact,
      r.items.map(i=>i.itemName).join('|'),
      r.items.map(i=>i.inventoryNumber).join('|'),
      r.items.map(i=>i.serialNumber).join('|'),
      r.borrowDate, r.returnDate||'N/A', fmtDate(r.returnedAt),
      r.returnCondition||'', r.returnNotes||'',
    ]);
    const csv = [headers,...rows].map(row => row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `returned-${monthFilter.replace(/\s+/g,'-')}.csv`;
    a.click();
  }

  function toggleNotes(id: string) {
    setExpandedNotes(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  return (
    <div className="max-w-6xl">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-800 flex-1">
            Returned Items
            <span className="ml-2 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">{filtered.length}</span>
          </h3>
          <select value={monthFilter} onChange={e => { setMonth(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
            {months.map(m => <option key={m} value={m}>{m==='All'?'All Months':m}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Items','Borrower','Department','Contact','Due Date','Returned At','Condition','Notes','Photo'].map(h => (
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
                <tr><td colSpan={9} className="text-center text-gray-500 py-12 text-sm">No returned items found.</td></tr>
              ) : paginated.map(req => {
                const expanded = expandedNotes.has(req.id);
                return (
                  <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-medium text-gray-800">{req.items.map(i=>i.itemName).join(', ')}</td>
                    <td className="px-5 py-4 text-gray-800">{req.borrowerName}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerDepartment}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerContact}</td>
                    <td className="px-5 py-4 text-gray-600">{req.returnDate||'—'}</td>
                    <td className="px-5 py-4 text-gray-600">{fmtDate(req.returnedAt)}</td>
                    <td className="px-5 py-4">{condBadge(req.returnCondition)}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[180px]">
                      {req.returnNotes ? (
                        <div>
                          <p className={`text-sm ${!expanded?'truncate':''}`}>{req.returnNotes}</p>
                          {req.returnNotes.length > 60 && (
                            <button onClick={() => toggleNotes(req.id)} className="text-xs text-purple-600 hover:underline mt-0.5">
                              {expanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      {req.damagePhotoUrl ? (
                        <img src={req.damagePhotoUrl} alt="Damage" onClick={() => setLightboxImg(req.damagePhotoUrl)}
                          className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"/>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              {Array.from({length:totalPages},(_,i)=>i+1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p===page?'bg-purple-700 text-white':'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Damage photo" className="max-w-full max-h-full rounded-xl shadow-2xl"/>
        </div>
      )}
    </div>
  );
}
