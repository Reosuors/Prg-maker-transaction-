/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Trash2, Download, Upload, RefreshCw, Check, Sparkles } from 'lucide-react';
import { TranslationMemoryEntry } from '../types';
import { TranslationMemoryDB } from '../utils/translationMemory';

interface TranslationMemoryModalProps {
  onClose: () => void;
}

export const TranslationMemoryModal: React.FC<TranslationMemoryModalProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<TranslationMemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrig, setNewOrig] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const reload = () => {
    setEntries(TranslationMemoryDB.getAll());
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrig.trim() || !newTrans.trim()) return;

    TranslationMemoryDB.set(newOrig, newTrans, newNotes || 'مضاف يدوياً');
    setNewOrig('');
    setNewTrans('');
    setNewNotes('');
    reload();
    showNotice('تمت إضافة المصطلح إلى قاعدة البيانات');
  };

  const handleDelete = (original: string) => {
    TranslationMemoryDB.delete(original);
    reload();
    showNotice('تم حذف المصطلح');
  };

  const handleExportJson = () => {
    const jsonStr = TranslationMemoryDB.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rpg_translation_memory_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csvStr = TranslationMemoryDB.exportCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rpg_translation_memory_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const count = TranslationMemoryDB.importJSON(content);
        reload();
        showNotice(`تم استيراد ${count} مصطلح بنجاح.`);
      } catch (err: any) {
        alert(err?.message || 'فشل استيراد الملف.');
      }
    };
    reader.readAsText(file);
  };

  const showNotice = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const filtered = entries.filter(
    (e) =>
      e.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.translation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="tm-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                قاعدة بيانات الترجمة والذاكرة المشتركة
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {entries.length} مصطلح
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تحفظ المصطلحات والأسماء المترجمة تلقائياً لمنع استهلاك التوكنز وتوحيد الترجمة في ألعابك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition"
              title="تصدير JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير JSON</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition"
              title="تصدير CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <label className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>استيراد</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action / Add Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col md:flex-row items-center gap-4 justify-between">
          <form onSubmit={handleAdd} className="flex flex-1 items-center gap-2 w-full">
            <input
              type="text"
              placeholder="النص الأصلي (مثل: Excalibur)"
              value={newOrig}
              onChange={(e) => setNewOrig(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="الترجمة العربية (مثل: سيف إكسكاليبر)"
              value={newTrans}
              onChange={(e) => setNewTrans(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-400 transition flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </form>

          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث في المصطلحات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:border-amber-500"
            />
          </div>
        </div>

        {/* Notice banner */}
        {statusMsg && (
          <div className="bg-emerald-500/20 text-emerald-300 text-xs px-4 py-2 border-b border-emerald-500/30 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 text-left">النص الأصلي</th>
                  <th className="py-2.5 px-4">الترجمة العربية</th>
                  <th className="py-2.5 px-4 text-center">مرات الاستخدام</th>
                  <th className="py-2.5 px-4">ملاحظات</th>
                  <th className="py-2.5 px-4 text-center w-16">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <tr key={item.original} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-4 font-mono text-slate-300 text-left" dir="ltr">
                        {item.original}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-amber-300">
                        {item.translation}
                      </td>
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">
                          {item.count || 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {item.notes || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleDelete(item.original)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      لا توجد مصطلحات مطابقة في قاعدة البيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>يتم دمج هذا القاموس تلقائياً في كل طلب ذكاء اصطناعي لضمان أفضل اتساق للأسماء</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
