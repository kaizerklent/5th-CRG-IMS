'use client';
import { useState, useEffect } from 'react';
import { BorrowRequest } from '@/lib/types/inventory';
import { subscribeAllBorrows } from '@/lib/firebase/firestore';

const PER_PAGE = 10;

const condBadge = (c: string|null) => {
  if (!c) return <span className="text-gray-400">—</span>;
  const m: Record<string,string> = {
    Good:'bg-green-100 text-green-700', Fair:'bg-yellow-100 text-yellow-700', Damaged:'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${m[c]||'bg-gray-100 text-gray-700'}`}>{c}</span>;
};

function Spinner() {
  return <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>;
}

export default function HistoryTab() {
  const [all, setAll]       = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'All'|'Approved'|'Returned'>('All');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);

  useEffect(() => {
    return subscribeAllBorrows(data => { setAll(data); setLoading(false); });
  }, []);

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    return (status==='All' || r.status===status) &&
      (!from || r.borrowDate >= from) &&
      (!to   || r.borrowDate <= to) &&
      (r.borrowerName.toLowerCase().includes(q) ||
       r.items.some(i => i.itemName.toLowerCase().includes(q)));
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const hasFilters = search || from || to || status !== 'All';

  function clear() { setSearch(''); setFrom(''); setTo(''); setStatus('All'); setPage(1); }

  return (
    <div className="max-w-6xl space-y-4">

      {/* Filters */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input type="text" placeholder="Borrower name or item name..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-base"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={status} onChange={e => { setStatus(e.target.value as any); setPage(1); }}
              className="input-base bg-white w-auto">
              <option value="All">All</option>
              <option value="Approved">Approved</option>
              <option value="Returned">Returned</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="input-base w-auto"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="input-base w-auto"/>
          </div>
          {hasFilters && (
            <button onClick={clear} className="btn-secondary">Clear Filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">
            Borrow Logbook
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {loading ? '…' : `${filtered.length} records`}
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Ref ID','Borrower','Department','Items','Borrow Date','Return Date','Status','Condition'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400"><Spinner/><span className="text-sm">Loading records...</span></div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-12 text-sm">
                  {hasFilters ? 'No records match your filters.' : 'No borrow records yet.'}
                </td></tr>
              ) : paginated.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-mono text-xs text-gray-400">{r.id.slice(0,8)}…</td>
                  <td className="px-5 py-4 font-medium text-gray-800 whitespace-nowrap">{r.borrowerName}</td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.borrowerDepartment}</td>
                  <td className="px-5 py-4 text-gray-600 max-w-[200px]">
                    <p className="truncate">{r.items.map(i=>i.itemName).join(', ')}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.borrowDate}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {r.returnDate
                      ? <span className="text-gray-600">{r.returnDate}</span>
                      : <span className="text-yellow-600 font-medium">Not set</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={r.status==='Returned'?'badge-returned':'badge-approved'}>{r.status}</span>
                  </td>
                  <td className="px-5 py-4">{condBadge(r.returnCondition)}</td>
                </tr>
              ))}
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
    </div>
  );
}
