'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { updateDisplayName, changePassword } from '@/lib/firebase/auth';

function Spinner() {
  return <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>;
}

function Alert({ type, msg }: { type: 'success'|'error'; msg: string }) {
  const s = type==='success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700';
  const icon = type==='success'
    ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
    : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z';
  return (
    <div className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2.5 ${s}`}>
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d={icon} clipRule="evenodd"/>
      </svg>
      {msg}
    </div>
  );
}

export default function ProfileTab() {
  const { user } = useAuth();
  const displayName = user?.displayName || '';
  const email       = user?.email       || '';
  const avatar      = (displayName || email || 'A').charAt(0).toUpperCase();

  const [nameVal, setNameVal]   = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg]   = useState<{type:'success'|'error'; text:string}|null>(null);

  const [curPw, setCurPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confPw, setConfPw]     = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg]       = useState<{type:'success'|'error'; text:string}|null>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameVal.trim()) return;
    setSavingName(true); setNameMsg(null);
    try {
      await updateDisplayName(nameVal.trim());
      setNameMsg({ type:'success', text:'Name updated successfully.' });
      setTimeout(() => setNameMsg(null), 4000);
    } catch {
      setNameMsg({ type:'error', text:'Failed to update name. Please try again.' });
    } finally { setSavingName(false); }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ type:'error', text:'New password must be at least 6 characters.' }); return; }
    if (newPw !== confPw)  { setPwMsg({ type:'error', text:'Passwords do not match.' }); return; }
    setSavingPw(true);
    try {
      await changePassword(curPw, newPw);
      setCurPw(''); setNewPw(''); setConfPw('');
      setPwMsg({ type:'success', text:'Password changed successfully.' });
      setTimeout(() => setPwMsg(null), 4000);
    } catch (err: any) {
      const c = err?.code||'';
      if (c==='auth/wrong-password'||c==='auth/invalid-credential')
        setPwMsg({ type:'error', text:'Current password is incorrect.' });
      else if (c==='auth/too-many-requests')
        setPwMsg({ type:'error', text:'Too many attempts. Please try again later.' });
      else
        setPwMsg({ type:'error', text:'Failed to change password. Please try again.' });
    } finally { setSavingPw(false); }
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0 shadow">
            <span className="text-white text-2xl font-bold">{avatar}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{displayName || 'Admin'}</h2>
            <p className="text-sm text-gray-500">{email}</p>
            <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-0.5 rounded-full">
              Administrator
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4 border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-700">Edit Profile</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)}
              placeholder="Your full name" className="input-base"/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" value={email} disabled
              className="input-base bg-gray-50 text-gray-400 cursor-not-allowed"/>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here — update in Firebase console.</p>
          </div>

          {nameMsg && <Alert type={nameMsg.type} msg={nameMsg.text}/>}

          <button type="submit" disabled={savingName||!nameVal.trim()} className="btn-primary w-full py-2.5">
            {savingName ? <><Spinner/> Saving...</> : 'Save Name'}
          </button>
        </form>
      </div>

      {/* Password card */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Change Password</h3>

        {pwMsg && <div className="mb-4"><Alert type={pwMsg.type} msg={pwMsg.text}/></div>}

        <form onSubmit={handleChangePw} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" required value={curPw} onChange={e => setCurPw(e.target.value)}
              placeholder="••••••••" className="input-base"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 6 characters" className="input-base"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" required value={confPw} onChange={e => setConfPw(e.target.value)}
              placeholder="Repeat new password" className="input-base"/>
          </div>
          <button type="submit" disabled={savingPw} className="btn-primary w-full py-2.5">
            {savingPw ? <><Spinner/> Changing Password...</> : 'Change Password'}
          </button>
        </form>
      </div>

    </div>
  );
}
