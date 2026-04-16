'use client';
import { useState, useEffect, useMemo } from 'react';
import { BorrowRequest } from '@/lib/types/inventory';
import { subscribeActiveBorrows, markReturned } from '@/lib/firebase/firestore';

const PER_PAGE = 8;

// ✅ FIX: today is now computed inside the component via useMemo so it stays
// accurate if the app is left open past midnight — previously it was a module-
// level constant that only evaluated once on first load.

function Spinner() {
  return <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>;
}

function ReturnModal({ req, onClose, onConfirm }: {
  req: BorrowRequest;
  onClose: () => void;
  onConfirm: (cond: 'Good'|'Fair'|'Damaged', notes: string) => Promise<void>;
}) {
  const [cond, setCond]   = useState<'Good'|'Fair'|'Damaged'>('Good');
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string|null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Mark as Returned</h3>
          <p className="text-sm text-gray-500 mt-1">{req.borrowerName} — {req.items.map(i=>i.itemName).join(', ')}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Return Condition</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Good','Fair','Damaged'] as const).map(c => (
                <button key={c} type="button" onClick={() => setCond(c)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition
                    ${cond === c
                      ? c==='Good' ? 'bg-green-50 border-green-500 text-green-700'
                        : c==='Fair' ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                        : 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {cond === 'Damaged' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              ⚠️ Damage photo upload available after Firebase Storage is enabled.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-xs text-gray-400">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Any notes about the return..."
              className="input-base resize-none"/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">Cancel</button>
          <button disabled={busy} onClick={async () => {
            setBusy(true); setErr(null);
            try { await onConfirm(cond, notes); }
            catch { setErr('Failed. Please try again.'); setBusy(false); }
          }}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
            {busy ? <><Spinner/>Saving...</> : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BorrowedTab() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [returning, setReturning] = useState<BorrowRequest|null>(null);

  // ✅ FIX: Compute today inside the component so it re-evaluates on each render
  // rather than being frozen at the time the module was first loaded.
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const flag     = (rd: string|null) => !rd ? 'no-date' : rd < today ? 'overdue' : 'normal';
  const daysOver = (rd: string) => Math.ceil((new Date(today).getTime() - new Date(rd).getTime()) / 86400000);

  useEffect(() => {
    return subscribeActiveBorrows(data => { setRequests(data); setLoading(false); });
  }, []);

  const totalPages = Math.ceil(requests.length / PER_PAGE);
  const paginated  = requests.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <div className="max-w-6xl">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Currently Borrowed
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{requests.length}</span>
          </h3>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300 inline-block"/>Overdue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-300 inline-block"/>No due date</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Borrower','Department','Contact','Items','Borrow Date','Return Date','Action'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400"><Spinner/><span className="text-sm">Loading...</span></div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-500 py-12 text-sm">No items currently borrowed.</td></tr>
              ) : paginated.map(req => {
                const f = flag(req.returnDate);
                return (
                  <tr key={req.id} className={`border-b border-gray-50 ${f==='overdue'?'row-overdue':f==='no-date'?'row-no-date':''}`}>
                    <td className="px-5 py-4 font-medium text-gray-800">{req.borrowerName}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerDepartment}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerContact}</td>
                    <td className="px-5 py-4 text-gray-600">{req.items.map(i=>`${i.itemName}${i.quantity>1?` (x${i.quantity})`:''}`).join(', ')}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowDate}</td>
                    <td className="px-5 py-4">
                      {f==='overdue' ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-red-600 font-medium">{req.returnDate}</span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                            ⚠️ {daysOver(req.returnDate!)}d overdue
                          </span>
                        </div>
                      ) : f==='no-date'
                        ? <span className="text-yellow-600 font-medium">Not set</span>
                        : <span className="text-gray-600">{req.returnDate}</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => setReturning(req)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                        Mark Returned
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,requests.length)} of {requests.length}</p>
            <div className="flex gap-1">
              {Array.from({length:totalPages},(_,i)=>i+1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p===page?'bg-purple-700 text-white':'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {returning && (
        <ReturnModal req={returning} onClose={() => setReturning(null)}
          onConfirm={async (cond, notes) => { await markReturned(returning, cond, notes, null); setReturning(null); }}/>
      )}
    </div>
  );
}