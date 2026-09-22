/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EngineType = 'rpgmaker_mv_mz' | 'generic_json' | 'unknown';

export interface TranslatableItem {
  id: string;
  filePath: string;
  jsonPath: string[]; // e.g. ['events', 0, 'pages', 0, 'list', 3, 'parameters', 0]
  originalText: string;
  translatedText?: string;
  context: string;
  status: 'pending' | 'translated' | 'cached' | 'error';
  error?: string;
}

export interface GameFile {
  path: string;
  size: number;
  type: 'data_json' | 'font' | 'html' | 'asset' | 'other';
  rawContent?: string;
  translatableItems: TranslatableItem[];
  status: 'pending' | 'translating' | 'completed' | 'skipped' | 'error';
  isTranslated: boolean;
}

export interface AIProviderConfig {
  provider: 'gemini' | 'custom';
  model: string;
  apiKey: string;
  baseUrl: string;
  batchSize: number;
  concurrency: number; // Number of parallel translation requests (e.g. 3-6)
  turboMode: boolean; // Ultra-fast parallel pipeline
  autoResume: boolean;
  autoRetryOnDisconnect: boolean;
  includeGlossary: boolean;
  allowMatureDialogue: boolean;
  sourceLang: string;
  targetLang: string;
}

export interface TranslationMemoryEntry {
  original: string;
  translation: string;
  notes?: string;
  count: number;
  updatedAt: number;
}

export interface TranslationProgress {
  isRunning: boolean;
  isPaused: boolean;
  isDisconnected: boolean;
  totalStrings: number;
  translatedStrings: number;
  cachedStrings: number;
  failedStrings: number;
  totalFiles: number;
  translatedFiles: number;
  currentFileName: string;
  currentBatch: number;
  totalBatches: number;
  speedPerSec: number;
  startTime: number;
  estimatedSecondsLeft: number;
  errorLog: string[];
}
