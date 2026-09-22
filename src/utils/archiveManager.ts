/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { GameFile } from '../types';
import { applyTranslationsToJson } from './rpgMakerParser';
import { injectArabicFontIntoZip } from './arabicFontInjector';

export class ArchiveManager {
  /**
   * Generates a zip containing ONLY the files that were successfully translated.
   */
  public static async exportTranslatedOnlyZip(gameFiles: GameFile[]): Promise<Blob> {
    const zip = new JSZip();

    const translatedFiles = gameFiles.filter(
      (f) => f.isTranslated || f.translatableItems.some((item) => item.status === 'translated' || item.status === 'cached')
    );

    for (const file of translatedFiles) {
      if (file.rawContent) {
        try {
          const parsed = JSON.parse(file.rawContent);
          const patched = applyTranslationsToJson(parsed, file.translatableItems);
          zip.file(file.path, JSON.stringify(patched, null, 2));
        } catch {
          zip.file(file.path, file.rawContent);
        }
      }
    }

    // Add a readme metadata file
    zip.file(
      'TRANSLATION_INFO.txt',
      `RPG Maker Game AI Translator - ملفات مترجمة فقط\nتاريخ التصدير: ${new Date().toLocaleString('ar-EG')}\nعدد الملفات المترجمة: ${translatedFiles.length}\nانسخ هذه الملفات وضعها داخل مجلد اللعبة (data/).\n`
    );

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /**
   * Generates a zip containing ONLY the files that still have untranslated text.
   */
  public static async exportUntranslatedOnlyZip(gameFiles: GameFile[]): Promise<Blob> {
    const zip = new JSZip();

    const untranslatedFiles = gameFiles.filter((f) =>
      f.translatableItems.some((item) => item.status === 'pending' || item.status === 'error')
    );

    for (const file of untranslatedFiles) {
      if (file.rawContent) {
        zip.file(file.path, file.rawContent);
      }
    }

    zip.file(
      'PENDING_INFO.txt',
      `RPG Maker Game AI Translator - ملفات متبقية لم تترجم بعد\nتاريخ التصدير: ${new Date().toLocaleString('ar-EG')}\nعدد الملفات المتبقية: ${untranslatedFiles.length}\nيمكنك إعادة رفع هذا الملف المضغوط لاحقاً لاستكمال الترجمة.\n`
    );

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /**
   * Replaces translated data files in the full game zip and optionally injects Arabic fonts.
   * Uses low compression level for fast generation and to prevent browser memory exhaustion on large files.
   */
  public static async exportFullGameZip(
    originalZip: JSZip | null,
    gameFiles: GameFile[],
    injectArabicFont = true,
    onProgress?: (percent: number, currentFile: string) => void
  ): Promise<Blob> {
    const zip = originalZip || new JSZip();

    for (const file of gameFiles) {
      const hasTranslations = file.translatableItems.some(
        (i) => i.status === 'translated' || i.status === 'cached'
      );
      if (hasTranslations && file.rawContent) {
        try {
          const parsed = JSON.parse(file.rawContent);
          const patched = applyTranslationsToJson(parsed, file.translatableItems);
          zip.file(file.path, JSON.stringify(patched, null, 2));
        } catch (e) {
          console.error(`Error updating ${file.path} in full zip:`, e);
        }
      }
    }

    if (injectArabicFont) {
      await injectArabicFontIntoZip(zip);
    }

    // Optimization: for large games (2-3GB), level 1 or STORE prevents out-of-memory crashes
    return await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      },
      (metadata) => {
        if (onProgress) {
          onProgress(Math.round(metadata.percent), metadata.currentFile || '');
        }
      }
    );
  }

  /**
   * Creates a complete backup JSON of all translatable items and status to resume anytime.
   */
  public static exportProjectStateJson(gameFiles: GameFile[], gameName: string): Blob {
    const state = {
      gameName,
      exportDate: new Date().toISOString(),
      files: gameFiles.map((f) => ({
        path: f.path,
        size: f.size,
        type: f.type,
        status: f.status,
        isTranslated: f.isTranslated,
        translatableItems: f.translatableItems,
      })),
    };

    return new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
  }
}
