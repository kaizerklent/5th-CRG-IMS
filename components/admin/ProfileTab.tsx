'use client';
import * as XLSX from 'xlsx';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { updateDisplayName, changePassword, sendPasswordReset } from '@/lib/firebase/auth';
import {
  subscribeInventory, subscribeAllBorrows, subscribeCategories,
  addCategory, deleteCategory, updateCategory,
  addSubCategory, deleteSubCategory, renameSubCategory,
} from '@/lib/firebase/firestore';
import { InventoryItem, BorrowRequest, AdminHistory, CustomCategory } from '@/lib/types/inventory';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import {
  SystemSettings, DEFAULT_SETTINGS, loadSystemSettings, saveSystemSettings,
} from '@/lib/hooks/useSystemSettings';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  const sz = sm ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={`animate-spin ${sz}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  const s = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700';
  const icon = type === 'success'
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

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon}/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && <div className="px-6 pb-6 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── SubCategoryPanel — own local state so inputs don't bleed between categories ──

interface SubCategoryPanelProps {
  cat: CustomCategory;
  adminName: string;
  editingSubKey: string | null;
  editingSubVal: string;
  savingSubEdit: boolean;
  onStartEdit: (catId: string, subName: string) => void;
  onSaveEdit: (cat: CustomCategory, oldName: string) => void;
  onCancelEdit: () => void;
  onEditValChange: (val: string) => void;
  onConfirmDelete: (cat: CustomCategory, sub: string) => void;
}

function SubCategoryPanel({
  cat, adminName,
  editingSubKey, editingSubVal, savingSubEdit,
  onStartEdit, onSaveEdit, onCancelEdit, onEditValChange, onConfirmDelete,
}: SubCategoryPanelProps) {
  // ── Local state — isolated per panel instance ────────────────────────────
  const [newSub, setNewSub]       = useState('');
  const [adding, setAdding]       = useState(false);
  const [addErr, setAddErr]       = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const subs = cat.subCategories ?? [];

  async function handleAdd() {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    if (subs.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setAddErr(`"${trimmed}" already exists under "${cat.name}".`);
      return;
    }
    setAdding(true); setAddErr(null);
    try {
      await addSubCategory(cat.id, cat.name, trimmed, adminName);
      setNewSub('');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
    } catch { setAddErr('Failed to add sub-category. Please try again.'); }
    finally { setAdding(false); }
  }

  return (
    <div className="bg-gray-50/70 border-t border-gray-100 px-6 py-3 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Sub-categories of "{cat.name}"
      </p>

      {subs.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-1">No sub-categories yet.</p>
      ) : (
        <div className="space-y-1.5">
          {[...subs].sort().map(sub => {
            const key       = `${cat.id}:${sub}`;
            const isEditing = editingSubKey === key;
            return (
              <div key={sub} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                </svg>

                {isEditing ? (
                  <input type="text" value={editingSubVal} autoFocus
                    onChange={e => onEditValChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onSaveEdit(cat, sub);
                      if (e.key === 'Escape') onCancelEdit();
                    }}
                    className="flex-1 px-2 py-0.5 border border-purple-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                ) : (
                  <span className="flex-1 text-xs font-medium text-gray-700">{sub}</span>
                )}

                {isEditing ? (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => onSaveEdit(cat, sub)} disabled={savingSubEdit}
                      className="w-6 h-6 rounded flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-100 transition">
                      {savingSubEdit
                        ? <Spinner sm/>
                        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      }
                    </button>
                    <button type="button" onClick={onCancelEdit}
                      className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => onStartEdit(cat.id, sub)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button type="button" onClick={() => onConfirmDelete(cat, sub)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add sub-category — local input, fully isolated */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newSub}
          onChange={e => { setNewSub(e.target.value); setAddErr(null); }}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`Add sub-category under "${cat.name}"...`}
          className="input-base flex-1 text-xs py-1.5"
          disabled={adding}
          maxLength={40}
        />
        <button type="button" onClick={handleAdd}
          disabled={adding || !newSub.trim()}
          className="btn-primary px-4 py-1.5 text-xs flex-shrink-0">
          {adding ? <Spinner sm/> : 'Add'}
        </button>
      </div>
      {addErr     && <p className="text-xs text-red-600">{addErr}</p>}
      {addSuccess && <p className="text-xs text-green-600">Sub-category added.</p>}
    </div>
  );
}

// ─── Inventory Categories section ─────────────────────────────────────────────

function InventoryCategoriesSection() {
  const { user } = useAuth();
  const adminName = user?.displayName || user?.email || 'Admin';

  const [categories, setCategories]         = useState<CustomCategory[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingCats, setLoadingCats]       = useState(true);
  const [loadingItems, setLoadingItems]     = useState(true);

  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [adding, setAdding]         = useState(false);
  const [addErr, setAddErr]         = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErr, setDeleteErr]   = useState<string | null>(null);
  const [confirmCat, setConfirmCat] = useState<CustomCategory | null>(null);

  const [editingCatId, setEditingCatId]     = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [savingCatEdit, setSavingCatEdit]   = useState(false);
  const [catEditErr, setCatEditErr]         = useState<string | null>(null);

  const [expandedCatId, setExpandedCatId]     = useState<string | null>(null);
  const [editingSubKey, setEditingSubKey]     = useState<string | null>(null);
  const [editingSubVal, setEditingSubVal]     = useState('');
  const [savingSubEdit, setSavingSubEdit]     = useState(false);
  const [confirmSub, setConfirmSub]           = useState<{ cat: CustomCategory; sub: string } | null>(null);

  useEffect(() => {
    const u1 = subscribeCategories(data => { setCategories(data); setLoadingCats(false); });
    const u2 = subscribeInventory(data => { setInventoryItems(data); setLoadingItems(false); });
    return () => { u1(); u2(); };
  }, []);

  function usageCount(catName: string): number {
    return inventoryItems.filter(i => i.category === catName).length;
  }

  const sortedCategories = [...categories].sort((a, b) => {
    if (a.name === 'Other') return 1;
    if (b.name === 'Other') return -1;
    return a.name.localeCompare(b.name);
  });

  async function handleAdd() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const isDuplicate = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) { setAddErr(`"${trimmed}" already exists.`); return; }
    setAdding(true); setAddErr(null);
    try {
      const catId = await addCategory(trimmed, adminName);
      if (newSubName.trim()) {
        await addSubCategory(catId, trimmed, newSubName.trim(), adminName);
      }
      setNewCatName(''); setNewSubName('');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
    } catch { setAddErr('Failed to add category. Please try again.'); }
    finally { setAdding(false); }
  }

  function startEditCat(cat: CustomCategory) {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setCatEditErr(null);
  }

  async function saveEditCat(cat: CustomCategory) {
    const trimmed = editingCatName.trim();
    if (!trimmed || trimmed === cat.name) { setEditingCatId(null); return; }
    const isDuplicate = categories.some(c => c.id !== cat.id && c.name.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) { setCatEditErr(`"${trimmed}" already exists.`); return; }
    setSavingCatEdit(true); setCatEditErr(null);
    try {
      await updateCategory(cat.id, cat.name, trimmed, adminName);
      setEditingCatId(null);
    } catch { setCatEditErr('Failed to rename. Please try again.'); }
    finally { setSavingCatEdit(false); }
  }

  function requestDelete(cat: CustomCategory) {
    if (cat.name === 'Other') {
      setDeleteErr('"Other" is a protected category and cannot be deleted.');
      setTimeout(() => setDeleteErr(null), 4000);
      return;
    }
    const count = usageCount(cat.name);
    if (count > 0) {
      setDeleteErr(`"${cat.name}" is used by ${count} item${count !== 1 ? 's' : ''}. Reassign those items before deleting.`);
      setTimeout(() => setDeleteErr(null), 5000);
      return;
    }
    setConfirmCat(cat); setDeleteErr(null);
  }

  async function confirmDelete() {
    if (!confirmCat) return;
    setDeletingId(confirmCat.id); setConfirmCat(null);
    try { await deleteCategory(confirmCat.id, confirmCat.name, adminName); }
    catch { setDeleteErr('Failed to delete category. Please try again.'); }
    finally { setDeletingId(null); }
  }

  function startEditSub(catId: string, subName: string) {
    setEditingSubKey(`${catId}:${subName}`);
    setEditingSubVal(subName);
  }

  async function saveEditSub(cat: CustomCategory, oldName: string) {
    const trimmed = editingSubVal.trim();
    if (!trimmed || trimmed === oldName) { setEditingSubKey(null); return; }
    const subs = cat.subCategories ?? [];
    if (subs.some(s => s.toLowerCase() === trimmed.toLowerCase() && s !== oldName)) {
      setEditingSubKey(null); return;
    }
    setSavingSubEdit(true);
    try {
      await renameSubCategory(cat.id, cat.name, oldName, trimmed, adminName);
      setEditingSubKey(null);
    } catch { /* keep open */ }
    finally { setSavingSubEdit(false); }
  }

  async function handleDeleteSub(cat: CustomCategory, sub: string) {
    setConfirmSub(null);
    try { await deleteSubCategory(cat.id, cat.name, sub, adminName); }
    catch { setDeleteErr(`Failed to delete sub-category "${sub}".`); }
  }

  const loading = loadingCats || loadingItems;

  return (
    <div className="space-y-4 pt-4">

      {/* Delete Category Modal */}
      {confirmCat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Category?</h3>
            <p className="text-sm text-gray-600 mb-1 font-medium">"{confirmCat.name}"</p>
            <p className="text-sm text-gray-500 mb-6">This category and all its sub-categories will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCat(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sub-category Modal */}
      {confirmSub && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Sub-category?</h3>
            <p className="text-sm text-gray-600 mb-1 font-medium">"{confirmSub.sub}"</p>
            <p className="text-sm text-gray-500 mb-6">Under <strong>{confirmSub.cat.name}</strong>. Items using this sub-category will keep the value but it won't appear in dropdowns anymore.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSub(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDeleteSub(confirmSub.cat, confirmSub.sub)} className="btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category form */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Category</p>
        <div className="flex gap-2">
          <input type="text" value={newCatName}
            onChange={e => { setNewCatName(e.target.value); setAddErr(null); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Category name e.g. Camera, Ammo..."
            className="input-base flex-1" disabled={adding} maxLength={40}/>
          <button type="button" onClick={handleAdd}
            disabled={adding || !newCatName.trim()} className="btn-primary px-5 flex-shrink-0">
            {adding ? <><Spinner sm/> Adding...</> : 'Add'}
          </button>
        </div>
        {newCatName.trim() && (
          <div className="flex items-center gap-2 pl-1">
            <div className="flex flex-col items-center w-4 flex-shrink-0">
              <div className="w-px h-3 bg-gray-300"/>
              <div className="w-3 h-px bg-gray-300"/>
            </div>
            <input type="text" value={newSubName}
              onChange={e => setNewSubName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Optional: first sub-category (e.g. DSLR, Handgun...)"
              className="input-base flex-1 text-xs" disabled={adding} maxLength={40}/>
          </div>
        )}
        {addErr && <p className="text-xs text-red-600">{addErr}</p>}
        {addSuccess && <p className="text-xs text-green-600">Category added successfully.</p>}
      </div>

      {deleteErr  && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{deleteErr}</div>}
      {catEditErr && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{catEditErr}</div>}

      {/* Category list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Categories</p>
          {!loading && <span className="text-xs text-gray-400">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</span>}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Spinner/> Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center">
            <p className="text-sm text-gray-400">No categories yet.</p>
            <p className="text-xs text-gray-300 mt-1">Add your first one above.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {sortedCategories.map((cat, index) => {
                const count         = usageCount(cat.name);
                const isOther       = cat.name === 'Other';
                const isDeleting    = deletingId === cat.id;
                const inUse         = count > 0;
                const isExpanded    = expandedCatId === cat.id;
                const isEditingName = editingCatId === cat.id;
                const subs          = cat.subCategories ?? [];

                return (
                  <div key={cat.id}>
                    {/* Category row */}
                    <div className={`flex items-center gap-2 px-4 py-3 transition-colors ${isOther ? 'bg-gray-50/60' : 'hover:bg-gray-50'}`}>
                      <span className="text-xs text-gray-300 font-mono w-5 flex-shrink-0 text-right select-none">{index + 1}</span>

                      {isEditingName ? (
                        <input type="text" value={editingCatName} autoFocus
                          onChange={e => setEditingCatName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditCat(cat); if (e.key === 'Escape') setEditingCatId(null); }}
                          className="flex-1 px-2 py-1 border border-purple-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                      ) : (
                        <p className={`flex-1 text-sm font-medium truncate ${isOther ? 'text-gray-400' : 'text-gray-800'}`}>
                          {cat.name}
                          {isOther && <span className="ml-2 text-xs font-normal text-gray-300">(protected)</span>}
                          {subs.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">{subs.length} sub{subs.length !== 1 ? 's' : ''}</span>}
                        </p>
                      )}

                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>

                      {/* Sub-category expand toggle */}
                      {!isOther && (
                        <button type="button"
                          onClick={() => {
                            setExpandedCatId(isExpanded ? null : cat.id);
                            setEditingSubKey(null);
                          }}
                          title={isExpanded ? 'Collapse' : 'Manage sub-categories'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition ${isExpanded ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-700'}`}>
                          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </button>
                      )}

                      {isOther ? (
                        <div className="w-7 h-7 flex-shrink-0" title="Protected">
                          <svg className="w-4 h-4 text-gray-300 mx-auto mt-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-10v4"/>
                            <circle cx="12" cy="12" r="9" strokeWidth={2}/>
                          </svg>
                        </div>
                      ) : isEditingName ? (
                        <div className="flex gap-1 flex-shrink-0">
                          <button type="button" onClick={() => saveEditCat(cat)} disabled={savingCatEdit}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-100 transition">
                            {savingCatEdit ? <Spinner sm/> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                          </button>
                          <button type="button" onClick={() => setEditingCatId(null)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 flex-shrink-0">
                          <button type="button" onClick={() => startEditCat(cat)} title={`Rename "${cat.name}"`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button type="button" onClick={() => requestDelete(cat)} disabled={isDeleting || inUse}
                            title={inUse ? `In use by ${count} item${count !== 1 ? 's' : ''} — reassign first` : `Delete "${cat.name}"`}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition ${inUse ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : isDeleting ? 'bg-red-50 text-red-400 cursor-wait' : 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600'}`}>
                            {isDeleting ? <Spinner sm/> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sub-categories panel */}
                    {isExpanded && !isOther && (
                      <SubCategoryPanel
                        cat={cat}
                        adminName={adminName}
                        editingSubKey={editingSubKey}
                        editingSubVal={editingSubVal}
                        savingSubEdit={savingSubEdit}
                        onStartEdit={startEditSub}
                        onSaveEdit={saveEditSub}
                        onCancelEdit={() => setEditingSubKey(null)}
                        onEditValChange={setEditingSubVal}
                        onConfirmDelete={(c, s) => setConfirmSub({ cat: c, sub: s })}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Categories in use (purple badge) cannot be deleted — reassign inventory items first.
                {' '}<span className="font-medium text-gray-500">"Other"</span> is always protected.
                Click ▾ to manage sub-categories.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── System Settings section ──────────────────────────────────────────────────

function SystemSettingsSection() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => { setSettings(loadSystemSettings()); setLoaded(true); }, []);

  function upd<K extends keyof SystemSettings>(key: K, val: SystemSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: val }));
  }

  function handleSave()  { saveSystemSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 3000); }
  function handleReset() { setSettings(DEFAULT_SETTINGS); saveSystemSettings(DEFAULT_SETTINGS); setSaved(true); setTimeout(() => setSaved(false), 3000); }

  if (!loaded) return (
    <div className="pt-4 flex items-center gap-2 text-gray-400 text-sm">
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Loading settings...
    </div>
  );

  return (
    <div className="space-y-6 pt-4">
      {saved && <Alert type="success" msg="Settings saved successfully." />}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Borrow Defaults</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Return Period <span className="text-xs text-gray-400">(days)</span></label>
            <input type="number" min={1} max={365} value={settings.defaultReturnDays}
              onChange={e => upd('defaultReturnDays', Math.max(1, parseInt(e.target.value) || 1))} className="input-base"/>
            <p className="text-xs text-gray-400 mt-1">Pre-fills the return date field in Borrow tab.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overdue Threshold <span className="text-xs text-gray-400">(days past due)</span></label>
            <input type="number" min={0} max={30} value={settings.overdueThresholdDays}
              onChange={e => upd('overdueThresholdDays', Math.max(0, parseInt(e.target.value) || 0))} className="input-base"/>
            <p className="text-xs text-gray-400 mt-1">0 = flag immediately when past due date.</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dashboard Alerts</p>
        <div className="space-y-3">
          {[
            { key: 'showOverdueAlerts' as const,   label: 'Show Overdue Alerts',      desc: 'Red banner on dashboard for overdue items' },
            { key: 'showNoDueDateAlerts' as const,  label: 'Show No Due Date Alerts',  desc: 'Yellow banner for borrows with no return date set' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div><p className="text-sm font-medium text-gray-700">{label}</p><p className="text-xs text-gray-400">{desc}</p></div>
              <button type="button" onClick={() => upd(key, !settings[key])}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings[key] ? 'bg-purple-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Table Display</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Page</label>
          <select value={settings.itemsPerPage} onChange={e => upd('itemsPerPage', parseInt(e.target.value))} className="input-base bg-white w-40">
            {[5, 8, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} rows</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Applies to Inventory, Borrowed, Returned, and History tabs on next load.</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vendor Return</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Return Threshold <span className="text-xs text-gray-400">(₱ minimum item value)</span></label>
          <div className="relative w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₱</span>
            <input type="number" min={1} step={1000} value={settings.vendorReturnThreshold}
              onChange={e => upd('vendorReturnThreshold', Math.max(1, parseInt(e.target.value) || 50000))} className="input-base pl-7"/>
          </div>
          <p className="text-xs text-gray-400 mt-1">Items at or above this value will appear in the Vendor Returns tab. Default: ₱50,000.</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Inventory Categories</p>
        <p className="text-xs text-gray-400 mb-3">Manage categories and sub-categories. Changes apply immediately across the system.</p>
        <InventoryCategoriesSection />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave}  className="btn-primary px-6 py-2.5">Save Settings</button>
        <button onClick={handleReset} className="btn-secondary px-6 py-2.5">Reset to Defaults</button>
      </div>
    </div>
  );
}

// ─── Audit Log section ────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  add:          { bg: 'bg-green-100',  text: 'text-green-700',  icon: 'M12 4v16m8-8H4' },
  update:       { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  delete:       { bg: 'bg-red-100',    text: 'text-red-700',    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  vendorReturn: { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
  consume:      { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
};

function AuditLogSection() {
  const [logs, setLogs]           = useState<AdminHistory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'all'|'add'|'update'|'delete'|'vendorReturn'|'consume'>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'adminHistory'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminHistory)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter);

  function fmtTs(ts: any): string {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function actionLabel(a: string): string {
    if (a === 'vendorReturn') return 'Vendor Return';
    if (a === 'consume')      return 'Consumed';
    return a.charAt(0).toUpperCase() + a.slice(1);
  }

  function exportAuditLog() {
    setExporting(true);
    try {
      const headers = ['Action', 'Item Name', 'Details', 'Performed By', 'Date & Time'];
      const rows = filtered.map(log => [actionLabel(log.action), log.itemName || '—', log.details || '—', log.adminName || '—', fmtTs(log.timestamp)]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 55 }, { wch: 22 }, { wch: 24 }];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const ca = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[ca]) ws[ca].s = { font: { bold: true } };
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `audit-log${filter !== 'all' ? `-${filter}` : ''}-${today}.xlsx`);
    } finally { setExporting(false); }
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {(['all', 'add', 'update', 'delete', 'consume', 'vendorReturn'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition
              ${filter === f
                ? f === 'all'          ? 'bg-purple-700 text-white'
                  : f === 'add'        ? 'bg-green-600 text-white'
                  : f === 'update'     ? 'bg-blue-600 text-white'
                  : f === 'delete'     ? 'bg-red-600 text-white'
                  : f === 'consume'    ? 'bg-amber-600 text-white'
                  : 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'all' ? 'All Actions' : actionLabel(f)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">{loading ? '…' : `${filtered.length} of ${logs.length} records`}</span>
          <button onClick={exportAuditLog} disabled={loading || exporting || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-semibold rounded-lg transition">
            {exporting ? <><Spinner sm/> Exporting...</> : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Export Excel</>}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-8"><Spinner/><span className="text-sm">Loading audit log...</span></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No audit entries found.</p>
        ) : filtered.map(log => {
          const style = ACTION_STYLES[log.action] || ACTION_STYLES.update;
          return (
            <div key={log.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <svg className={`w-3.5 h-3.5 ${style.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon}/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{log.details}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{log.adminName}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{fmtTs(log.timestamp)}</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${style.bg} ${style.text}`}>
                {actionLabel(log.action)}
              </span>
            </div>
          );
        })}
      </div>
      {filtered.length > 0 && !loading && (
        <p className="text-xs text-gray-400 text-center">Exporting downloads the current filtered view ({filtered.length} record{filtered.length !== 1 ? 's' : ''}).</p>
      )}
    </div>
  );
}

// ─── Data Export section ──────────────────────────────────────────────────────

function DataExportSection() {
  const [inventory, setInventory]   = useState<InventoryItem[]>([]);
  const [borrows, setBorrows]       = useState<BorrowRequest[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingBor, setLoadingBor] = useState(true);
  const [exporting, setExporting]   = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeInventory(d => { setInventory(d); setLoadingInv(false); });
    const u2 = subscribeAllBorrows(d => { setBorrows(d); setLoadingBor(false); });
    return () => { u1(); u2(); };
  }, []);

  function downloadXLSX(filename: string, rows: string[][], headers: string[]) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    XLSX.writeFile(wb, filename);
  }

  async function exportInv() {
    setExporting('inventory');
    try {
      downloadXLSX(
        `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`,
        inventory.map(i => [
          i.name, i.category, i.subCategory || '',
          i.isUnique ? 'Unique' : i.isConsumable ? 'Consumable' : 'Bulk',
          String(i.quantity), i.condition, i.status,
          i.inventoryNumber, i.serialNumber, i.officeOwner,
          i.dateAcquired, i.inventoryDate, i.notes,
          i.value != null ? String(i.value) : '', i.borrowedBy || '',
        ]),
        ['Name','Category','Sub-category','Asset Type','Quantity','Condition','Status',
         'Inventory No.','Serial No.','Office Owner','Date Acquired','Inventory Date',
         'Notes','Value (₱)','Borrowed By'],
      );
    } finally { setExporting(null); }
  }

  async function exportBorrows(statusFilter?: 'Approved' | 'Returned') {
    const key = statusFilter?.toLowerCase() || 'all';
    setExporting(key);
    try {
      const data = statusFilter ? borrows.filter(b => b.status === statusFilter) : borrows;
      const fmtTs = (ts: any) => { if (!ts) return ''; const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toISOString().split('T')[0]; };
      downloadXLSX(
        `borrows-${key}-${new Date().toISOString().split('T')[0]}.xlsx`,
        data.map(r => [
          r.borrowerName, r.borrowerDepartment, r.borrowerContact,
          r.items.map(i => i.itemName).join(' | '),
          r.items.map(i => i.inventoryNumber).join(' | '),
          r.borrowDate, r.returnDate || '', r.status,
          fmtTs(r.returnedAt), r.returnCondition || '', r.returnNotes || '', r.notes,
        ]),
        ['Borrower','Department','Contact','Items','Inventory Numbers','Borrow Date','Return Date','Status','Returned At','Return Condition','Return Notes','Notes'],
      );
    } finally { setExporting(null); }
  }

  const loading = loadingInv || loadingBor;
  const exports = [
    { key: 'inventory', label: 'Full Inventory',     desc: `${inventory.length} items`,                                  color: 'purple', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', action: exportInv },
    { key: 'approved',  label: 'Active Borrows',     desc: `${borrows.filter(b=>b.status==='Approved').length} records`, color: 'blue',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', action: () => exportBorrows('Approved') },
    { key: 'returned',  label: 'Returned Records',   desc: `${borrows.filter(b=>b.status==='Returned').length} records`, color: 'green',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', action: () => exportBorrows('Returned') },
    { key: 'all',       label: 'All Borrow History', desc: `${borrows.length} total records`,                            color: 'gray',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', action: () => exportBorrows() },
  ];
  const colorMap: Record<string,string> = { purple:'bg-purple-100 text-purple-700', blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', gray:'bg-gray-100 text-gray-700' };

  return (
    <div className="pt-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 py-6"><Spinner/><span className="text-sm">Loading data...</span></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {exports.map(exp => (
            <div key={exp.key} className="border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[exp.color]}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={exp.icon}/></svg>
                </div>
                <div><p className="text-sm font-semibold text-gray-800">{exp.label}</p><p className="text-xs text-gray-400">{exp.desc}</p></div>
              </div>
              <button onClick={exp.action} disabled={!!exporting}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 text-sm font-medium text-gray-700 hover:text-purple-700 transition disabled:opacity-50">
                {exporting === exp.key ? <><Spinner sm/> Exporting...</> : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Export Excel</>}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3 text-center">Files open in Excel, Google Sheets, or any spreadsheet app.</p>
    </div>
  );
}

// ─── Account Security ─────────────────────────────────────────────────────────

function AccountSecuritySection({ user }: { user: any }) {
  const [sessionStart]            = useState(() => new Date());
  const [tick, setTick]           = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadMsg, setReloadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(user?.emailVerified ?? false);

  useEffect(() => { const t = setInterval(() => setTick(p => p + 1), 30000); return () => clearInterval(t); }, []);

  const sessionDuration = () => {
    const diff = Math.floor((new Date().getTime() - sessionStart.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const lastSignIn     = user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const accountCreated = user?.metadata?.creationTime   ? new Date(user.metadata.creationTime).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const providers      = user?.providerData?.map((p: any) => p.providerId) || [];
  const providerLabel  = providers.includes('password') ? 'Email / Password' : providers.join(', ') || 'Unknown';

  async function handleSendVerification() {
    setVerifying(true); setVerifyMsg(null);
    try {
      const { sendEmailVerification } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase/firebaseConfig');
      if (!auth.currentUser) throw new Error('No user');
      await sendEmailVerification(auth.currentUser, { url: window.location.origin });
      setVerifyMsg({ type: 'success', text: `Verification email sent to ${user.email}. Check your inbox (and spam folder).` });
    } catch (err: any) {
      const c = err?.code || '';
      setVerifyMsg({ type: 'error', text: c === 'auth/too-many-requests' ? 'Too many requests. Please wait a few minutes.' : 'Failed to send verification email. Please try again.' });
    } finally { setVerifying(false); }
  }

  async function handleReloadUser() {
    setReloading(true); setReloadMsg(null);
    try {
      const { auth } = await import('@/lib/firebase/firebaseConfig');
      if (!auth.currentUser) throw new Error('No user');
      await auth.currentUser.reload();
      const freshVerified = auth.currentUser.emailVerified;
      setIsVerified(freshVerified);
      if (freshVerified) { setVerifyMsg(null); setReloadMsg({ type: 'success', text: 'Email verified successfully!' }); }
      else { setReloadMsg({ type: 'error', text: 'Email not yet verified. Please click the link in the email.' }); }
    } catch { setReloadMsg({ type: 'error', text: 'Failed to refresh status. Please try again.' }); }
    finally { setReloading(false); }
  }

  const infoRows = [
    { label: 'Account Created', value: accountCreated },
    { label: 'Last Sign-In',    value: lastSignIn },
    { label: 'Current Session', value: sessionDuration() },
    { label: 'Auth Provider',   value: providerLabel },
    { label: 'User ID',         value: user?.uid || '—', mono: true },
  ];

  return (
    <div className="pt-4 space-y-5">
      <div className={`rounded-xl border px-4 py-4 ${isVerified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isVerified ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {isVerified
                ? <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                : <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              }
            </div>
            <div>
              <p className={`text-sm font-semibold ${isVerified ? 'text-green-800' : 'text-yellow-800'}`}>{isVerified ? 'Email Verified' : 'Email Not Verified'}</p>
              <p className={`text-xs mt-0.5 ${isVerified ? 'text-green-600' : 'text-yellow-700'}`}>{isVerified ? `${user?.email} has been verified.` : `${user?.email} — verify your email to secure your account.`}</p>
            </div>
          </div>
          {!isVerified && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={handleSendVerification} disabled={verifying} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                {verifying ? <><Spinner sm/> Sending...</> : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Verification Email</>}
              </button>
              <button onClick={handleReloadUser} disabled={reloading} className="flex items-center gap-1.5 px-3 py-1.5 border border-yellow-400 bg-white hover:bg-yellow-50 disabled:opacity-50 text-yellow-800 text-xs font-semibold rounded-lg transition whitespace-nowrap">
                {reloading ? <><Spinner sm/> Checking...</> : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>I've Verified — Check Status</>}
              </button>
            </div>
          )}
          {isVerified && (
            <button onClick={handleReloadUser} disabled={reloading} className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 transition disabled:opacity-50 flex-shrink-0">
              {reloading ? <Spinner sm/> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}
            </button>
          )}
        </div>
        {verifyMsg && <div className="mt-3"><Alert type={verifyMsg.type} msg={verifyMsg.text}/></div>}
        {reloadMsg && <div className="mt-3"><Alert type={reloadMsg.type} msg={reloadMsg.text}/></div>}
        {!isVerified && !verifyMsg && (
          <div className="mt-3 pt-3 border-t border-yellow-200">
            <p className="text-xs font-semibold text-yellow-800 mb-2">How to verify your email:</p>
            <ol className="space-y-1 text-xs text-yellow-700 list-none">
              {['Click "Send Verification Email" above.', `Open your inbox for ${user?.email}.`, 'Click the verification link in the email.', 'Return here and click "I\'ve Verified — Check Status".'].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-yellow-200 text-yellow-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {infoRows.map(row => (
          <div key={row.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-500 mb-0.5">{row.label}</p>
            <p className={`text-sm font-medium break-all text-gray-800 ${row.mono ? 'font-mono text-xs' : ''}`}>{row.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          Security Recommendations
        </p>
        <ul className="space-y-1.5 text-xs text-amber-700">
          <li>• Use a strong password (min. 12 characters with symbols)</li>
          <li>• Never share your admin credentials with others</li>
          <li>• Log out when leaving the system unattended</li>
          <li>• Change your password every 90 days</li>
          <li>• Verify your email to enable account recovery</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: any }) {
  const displayName = user?.displayName || '';
  const email       = user?.email || '';
  const avatar      = (displayName || email || 'A').charAt(0).toUpperCase();
  const [nameVal, setNameVal]       = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [curPw, setCurPw]           = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confPw, setConfPw]         = useState('');
  const [savingPw, setSavingPw]     = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingReset, setSendingReset]         = useState(false);
  const [resetMsg, setResetMsg]                 = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault(); if (!nameVal.trim()) return;
    setSavingName(true); setNameMsg(null);
    try { await updateDisplayName(nameVal.trim()); setNameMsg({ type: 'success', text: 'Name updated successfully.' }); setTimeout(() => setNameMsg(null), 4000); }
    catch { setNameMsg({ type: 'error', text: 'Failed to update name. Please try again.' }); }
    finally { setSavingName(false); }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    if (newPw !== confPw)  { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setSavingPw(true);
    try { await changePassword(curPw, newPw); setCurPw(''); setNewPw(''); setConfPw(''); setPwMsg({ type: 'success', text: 'Password changed successfully.' }); setTimeout(() => setPwMsg(null), 4000); }
    catch (err: any) {
      const c = err?.code || '';
      if (c === 'auth/wrong-password' || c === 'auth/invalid-credential') setPwMsg({ type: 'error', text: 'Current password is incorrect.' });
      else if (c === 'auth/too-many-requests') setPwMsg({ type: 'error', text: 'Too many attempts. Please try again later.' });
      else setPwMsg({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally { setSavingPw(false); }
  }

  async function handleForgotPassword() {
    setSendingReset(true); setResetMsg(null); setShowResetConfirm(false);
    try { await sendPasswordReset(email); setResetMsg({ type: 'success', text: `Password reset email sent to ${email}.` }); }
    catch (err: any) { const c = err?.code || ''; setResetMsg({ type: 'error', text: c === 'auth/too-many-requests' ? 'Too many requests. Please wait a few minutes.' : 'Failed to send reset email. Please try again.' }); }
    finally { setSendingReset(false); }
  }

  return (
    <>
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
              </div>
              <div><h3 className="text-base font-semibold text-gray-800">Reset Password?</h3><p className="text-xs text-gray-500 mt-0.5">A reset link will be emailed to you</p></div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4"><p className="text-xs text-gray-500 mb-0.5">Reset link will be sent to</p><p className="text-sm font-medium text-gray-800">{email}</p></div>
            <p className="text-sm text-gray-600 mb-5">You will receive an email with a link to set a new password. Your current password stays active until you complete the reset.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleForgotPassword} disabled={sendingReset} className="btn-primary flex-1 py-2.5">
                {sendingReset ? <><Spinner/> Sending...</> : 'Send Reset Email'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div className="w-16 h-16 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0 shadow"><span className="text-white text-2xl font-bold">{avatar}</span></div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{displayName || 'Admin'}</h2>
          <p className="text-sm text-gray-500">{email}</p>
          <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-0.5 rounded-full">Administrator</span>
        </div>
      </div>
      <form onSubmit={handleSaveName} className="space-y-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Profile</p>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)} placeholder="Your full name" className="input-base"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={email} disabled className="input-base bg-gray-50 text-gray-400 cursor-not-allowed"/><p className="text-xs text-gray-400 mt-1">Email cannot be changed here — update in Firebase console.</p></div>
        {nameMsg && <Alert type={nameMsg.type} msg={nameMsg.text}/>}
        <button type="submit" disabled={savingName || !nameVal.trim()} className="btn-primary w-full py-2.5">{savingName ? <><Spinner/> Saving...</> : 'Save Name'}</button>
      </form>
      <form onSubmit={handleChangePw} className="space-y-4 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Password</p>
          <button type="button" onClick={() => { setShowResetConfirm(true); setResetMsg(null); }} className="text-xs text-purple-600 hover:text-purple-800 font-medium transition">Forgot password?</button>
        </div>
        {resetMsg && <Alert type={resetMsg.type} msg={resetMsg.text}/>}
        {pwMsg && <Alert type={pwMsg.type} msg={pwMsg.text}/>}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label><input type="password" required value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" className="input-base"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">New Password</label><input type="password" required value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" className="input-base"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label><input type="password" required value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="Repeat new password" className="input-base"/></div>
        <button type="submit" disabled={savingPw} className="btn-primary w-full py-2.5">{savingPw ? <><Spinner/> Changing Password...</> : 'Change Password'}</button>
      </form>
    </>
  );
}

// ─── Developer Contacts ────────────────────────────────────────────────────────

const DEVELOPER_CONTACTS = [
  { name: 'Juan dela Cruz', role: 'Lead Developer',    email: 'juan.delacruz@placeholder.com', phone: '+63 917 123 4567', github: 'https://github.com/juandelacruz' },
  { name: 'Maria Santos',   role: 'Frontend Developer', email: 'maria.santos@placeholder.com',  phone: '+63 918 234 5678', github: 'https://github.com/mariasantos' },
  { name: 'Carlos Reyes',   role: 'Backend Developer',  email: 'carlos.reyes@placeholder.com',  phone: '+63 919 345 6789', github: 'https://github.com/carlosreyes' },
  { name: 'Ana Gonzales',   role: 'UI/UX Designer',     email: 'ana.gonzales@placeholder.com',  phone: '+63 920 456 7890', github: 'https://github.com/anagonzales' },
  { name: 'Ramon Torres',   role: 'Systems Analyst',    email: 'ramon.torres@placeholder.com',  phone: '+63 921 567 8901', github: 'https://github.com/ramontorres' },
];

function DeveloperCard({ dev }: { dev: typeof DEVELOPER_CONTACTS[0] }) {
  const initials = dev.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-purple-300 hover:bg-purple-50/30 transition">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-purple-700">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{dev.name}</p>
          <p className="text-xs text-gray-500 truncate">{dev.role}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <a href={`mailto:${dev.email}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-purple-700 transition group">
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span className="truncate">{dev.email}</span>
        </a>
        <a href={`tel:${dev.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-purple-700 transition group">
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          <span>{dev.phone}</span>
        </a>
        <a href={dev.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-600 hover:text-purple-700 transition group">
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
          <span className="truncate">{dev.github.replace('https://github.com/', '@')}</span>
        </a>
      </div>
    </div>
  );
}

function DeveloperContactsSection() {
  return (
    <div className="pt-4 space-y-3">
      <p className="text-xs text-gray-400">Reach out to the development team for technical support or system-related concerns.</p>
      <div className="grid grid-cols-3 gap-3">{DEVELOPER_CONTACTS.slice(0, 3).map(dev => <DeveloperCard key={dev.email} dev={dev}/>)}</div>
      <div className="grid grid-cols-3 gap-3">{DEVELOPER_CONTACTS.slice(3).map(dev => <DeveloperCard key={dev.email} dev={dev}/>)}</div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ProfileTab() {
  const { user } = useAuth();
  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Profile & Password" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
          <ProfileSection user={user}/>
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Account Security" defaultOpen={true} icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
            <AccountSecuritySection user={user}/>
          </SectionCard>
          <SectionCard title="System Settings" defaultOpen={false} icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z">
            <SystemSettingsSection/>
          </SectionCard>
        </div>
      </div>
      <SectionCard title="Data Export" defaultOpen={false} icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4">
        <DataExportSection/>
      </SectionCard>
      <SectionCard title="Audit Log" defaultOpen={false} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01">
        <AuditLogSection/>
      </SectionCard>
      <SectionCard title="Developer Contacts" defaultOpen={false} icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z">
        <DeveloperContactsSection/>
      </SectionCard>
    </div>
  );
}