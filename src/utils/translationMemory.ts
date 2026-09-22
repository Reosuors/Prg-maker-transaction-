/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TranslationMemoryEntry } from '../types';

const STORAGE_KEY = 'rpgmaker_translation_memory_v1';

// Seeded RPG Maker standard vocabulary (English & Japanese to Arabic)
const DEFAULT_PRESETS: Record<string, string> = {
  // Main Menu & Commands
  "New Game": "لعبة جديدة",
  "Continue": "متابعة",
  "Options": "الخيارات",
  "Game Over": "انتهت اللعبة",
  "Attack": "هجوم",
  "Defend": "دفاع",
  "Item": "عنصر",
  "Items": "العناصر",
  "Skill": "مهارة",
  "Skills": "المهارات",
  "Equip": "العتاد",
  "Status": "الحالة",
  "Formation": "التشكيلة",
  "Save": "حفظ",
  "To Title": "إلى القائمة الرئيسية",
  "Cancel": "إلغاء",
  "Buy": "شراء",
  "Sell": "بيع",
  "Escape": "هروب",

  // Stats
  "HP": "نقاط الحياة",
  "MP": "نقاط السحر",
  "TP": "نقاط الطاقة",
  "EXP": "الخبرة",
  "Level": "المستوى",
  "Gold": "ذهب",
  "Weapon": "سلاح",
  "Weapons": "الأسلحة",
  "Armor": "درع",
  "Armors": "الدروع",
  "Key Items": "عناصر هامة",

  // Common Dialogues
  "Yes": "نعم",
  "No": "لا",
  "Found": "تم العثور على",
  "Obtained": "حصلت على",

  // Japanese Standard RPG Maker Terms
  "たたかう": "هجوم",
  "にげる": "هروب",
  "ぼうぎょ": "دفاع",
  "アイテム": "عنصر",
  "スキル": "مهارة",
  "そうび": "العتاد",
  "ステータス": "الحالة",
  "セーブ": "حفظ",
  "コンティニュー": "متابعة",
  "ニューゲーム": "لعبة جديدة",
  "オファー": "خيارات",
  "かいもの": "تسوق",
  "はい": "نعم",
  "いいえ": "لا",
  "お金": "ذهب",
  "レベル": "المستوى",
  "攻撃": "هجوم",
  "防御": "دفاع",
  "魔法": "سحر"
};

export class TranslationMemoryDB {
  private static cache: Map<string, TranslationMemoryEntry> | null = null;

  private static load(): Map<string, TranslationMemoryEntry> {
    if (this.cache) return this.cache;
    const map = new Map<string, TranslationMemoryEntry>();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, TranslationMemoryEntry> = JSON.parse(raw);
        Object.entries(parsed).forEach(([k, v]) => map.set(k.trim(), v));
      } else {
        // Initialize presets
        const now = Date.now();
        Object.entries(DEFAULT_PRESETS).forEach(([orig, trans]) => {
          map.set(orig.trim(), {
            original: orig.trim(),
            translation: trans.trim(),
            count: 1,
            updatedAt: now,
            notes: "قاموس RPG Maker قياسي"
          });
        });
        this.persist(map);
      }
    } catch (e) {
      console.error("Error loading translation memory:", e);
    }

    this.cache = map;
    return map;
  }

  private static persist(map: Map<string, TranslationMemoryEntry>): void {
    try {
      const obj: Record<string, TranslationMemoryEntry> = {};
      map.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Could not persist to localStorage (may be full):", e);
    }
  }

  public static get(original: string): string | null {
    const map = this.load();
    const entry = map.get(original.trim());
    if (entry && entry.translation) {
      entry.count = (entry.count || 1) + 1;
      entry.updatedAt = Date.now();
      return entry.translation;
    }
    return null;
  }

  public static set(original: string, translation: string, notes?: string): void {
    const trimmedOrig = original.trim();
    const trimmedTrans = translation.trim();
    if (!trimmedOrig || !trimmedTrans) return;

    const map = this.load();
    const existing = map.get(trimmedOrig);
    map.set(trimmedOrig, {
      original: trimmedOrig,
      translation: trimmedTrans,
      notes: notes || existing?.notes,
      count: (existing?.count || 0) + 1,
      updatedAt: Date.now(),
    });
    this.persist(map);
  }

  public static setBatch(items: { original: string; translation: string; notes?: string }[]): void {
    const map = this.load();
    const now = Date.now();
    items.forEach(({ original, translation, notes }) => {
      const orig = original.trim();
      const trans = translation.trim();
      if (orig && trans) {
        const existing = map.get(orig);
        map.set(orig, {
          original: orig,
          translation: trans,
          notes: notes || existing?.notes,
          count: (existing?.count || 0) + 1,
          updatedAt: now,
        });
      }
    });
    this.persist(map);
  }

  public static getAll(): TranslationMemoryEntry[] {
    const map = this.load();
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static delete(original: string): boolean {
    const map = this.load();
    const deleted = map.delete(original.trim());
    if (deleted) {
      this.persist(map);
    }
    return deleted;
  }

  public static clear(): void {
    this.cache = new Map();
    localStorage.removeItem(STORAGE_KEY);
  }

  public static exportJSON(): string {
    const entries = this.getAll();
    return JSON.stringify(entries, null, 2);
  }

  public static importJSON(jsonStr: string): number {
    try {
      const data = JSON.parse(jsonStr);
      let imported = 0;
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.original && item.translation) {
            this.set(item.original, item.translation, item.notes);
            imported++;
          }
        });
      } else if (typeof data === 'object') {
        Object.entries(data).forEach(([orig, trans]) => {
          if (typeof trans === 'string') {
            this.set(orig, trans);
            imported++;
          } else if (typeof trans === 'object' && trans !== null && (trans as any).translation) {
            this.set(orig, (trans as any).translation, (trans as any).notes);
            imported++;
          }
        });
      }
      return imported;
    } catch (e) {
      console.error("Import JSON failed:", e);
      throw new Error("تنسيق ملف الذاكرة غير صالح.");
    }
  }

  public static exportCSV(): string {
    const entries = this.getAll();
    const header = "الأصل,الترجمة,مرات الاستخدام,ملاحظات\n";
    const rows = entries.map(e => {
      const escOrig = `"${e.original.replace(/"/g, '""')}"`;
      const escTrans = `"${e.translation.replace(/"/g, '""')}"`;
      const escNotes = `"${(e.notes || '').replace(/"/g, '""')}"`;
      return `${escOrig},${escTrans},${e.count},${escNotes}`;
    }).join("\n");
    return header + rows;
  }
}
