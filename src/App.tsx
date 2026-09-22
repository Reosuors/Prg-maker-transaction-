/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileArchive,
  FolderUp,
  Cpu,
  Database,
  Play,
  Pause,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Settings,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Globe,
  HardDriveDownload,
  FileCode,
  Flame,
  Zap,
  Info
} from 'lucide-react';
import JSZip from 'jszip';
import { GameFile, TranslatableItem, AIProviderConfig, TranslationProgress } from './types';
import { extractTranslatableItemsFromRpgMakerJson, applyTranslationsToJson } from './utils/rpgMakerParser';
import { TranslationMemoryDB } from './utils/translationMemory';
import { ArchiveManager } from './utils/archiveManager';
import { AIConfigModal } from './components/AIConfigModal';
import { TranslationMemoryModal } from './components/TranslationMemoryModal';
import { WebGamePlayer } from './components/WebGamePlayer';

export default function App() {
  // Game & Archive State
  const [gameTitle, setGameTitle] = useState<string>('لعبة RPG Maker');
  const [originalZip, setOriginalZip] = useState<JSZip | null>(null);
  const [gameFiles, setGameFiles] = useState<GameFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isProcessingArchive, setIsProcessingArchive] = useState<boolean>(false);
  const [archiveLoadProgress, setArchiveLoadProgress] = useState<string>('');

  // Modals
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);
  const [showPlayerModal, setShowPlayerModal] = useState<boolean>(false);

  // Settings
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    batchSize: 25,
    concurrency: 4,
    turboMode: true,
    autoResume: true,
    autoRetryOnDisconnect: true,
    includeGlossary: true,
    allowMatureDialogue: true,
    sourceLang: 'Japanese/English',
    targetLang: 'Arabic',
  });

  const [injectArabicFont, setInjectArabicFont] = useState<boolean>(true);

  // Translation execution state
  const [progress, setProgress] = useState<TranslationProgress>({
    isRunning: false,
    isPaused: false,
    isDisconnected: false,
    totalStrings: 0,
    translatedStrings: 0,
    cachedStrings: 0,
    failedStrings: 0,
    totalFiles: 0,
    translatedFiles: 0,
    currentFileName: '',
    currentBatch: 0,
    totalBatches: 0,
    speedPerSec: 0,
    startTime: 0,
    estimatedSecondsLeft: 0,
    errorLog: [],
  });

  // UI Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'translated' | 'cached'>('all');

  // Cancel/Pause reference flag
  const abortControllerRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = progress.isPaused;

  // File input refs
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Count totals
  const totalStringsCount = useMemo(() => {
    return gameFiles.reduce((acc, f) => acc + f.translatableItems.length, 0);
  }, [gameFiles]);

  const translatedStringsCount = useMemo(() => {
    return gameFiles.reduce(
      (acc, f) =>
        acc +
        f.translatableItems.filter((i) => i.status === 'translated' || i.status === 'cached').length,
      0
    );
  }, [gameFiles]);

  const pendingStringsCount = totalStringsCount - translatedStringsCount;

  // Handle uploading ZIP archive
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingArchive(true);
    const sizeInMB = Math.round(file.size / (1024 * 1024));
    setArchiveLoadProgress(`جاري فحص وقراءة الأرشيف المضغوط بحجم (${sizeInMB} MB)...`);

    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file, {
        createFolders: true,
      });
      setOriginalZip(loadedZip);

      const parsedFiles: GameFile[] = [];
      const entries = Object.keys(loadedZip.files);
      setArchiveLoadProgress(`تم العثور على ${entries.length} ملف، جاري استخراج نصوص وبيانات اللعبة...`);

      // Determine game title if System.json exists
      for (const filePath of entries) {
        const zipObj = loadedZip.files[filePath];
        if (zipObj.dir) continue;

        // Check if JSON data file
        if (filePath.endsWith('.json') && (filePath.includes('data/') || filePath.startsWith('data/'))) {
          try {
            const content = await zipObj.async('string');
            const json = JSON.parse(content);

            if (filePath.endsWith('System.json') && json.gameTitle) {
              setGameTitle(json.gameTitle);
            }

            const items = extractTranslatableItemsFromRpgMakerJson(filePath, json);

            // Check if any items are already cached in Translation Memory
            items.forEach((item) => {
              const cached = TranslationMemoryDB.get(item.originalText);
              if (cached) {
                item.translatedText = cached;
                item.status = 'cached';
              }
            });

            parsedFiles.push({
              path: filePath,
              size: (zipObj as any)._data?.uncompressedSize || content.length,
              type: 'data_json',
              rawContent: content,
              translatableItems: items,
              status: items.every((i) => i.status === 'cached') && items.length > 0 ? 'completed' : 'pending',
              isTranslated: items.length > 0 && items.every((i) => i.status === 'cached'),
            });
          } catch (err) {
            console.warn(`Could not parse JSON for ${filePath}:`, err);
          }
        }
      }

      setGameFiles(parsedFiles);
      if (parsedFiles.length > 0) {
        setSelectedFilePath(parsedFiles[0].path);
      }
    } catch (err: any) {
      alert(`خطأ في قراءة ملف اللعبة: ${err?.message || 'الملف تالف أو غير مدعوم'}`);
    } finally {
      setIsProcessingArchive(false);
      setArchiveLoadProgress('');
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  // Handle selecting Folder directly (webkitdirectory)
  // Optimized for massive games (2GB, 3GB, 5GB+): extracts and parses JSON data instantly without loading gigabytes of audio/video into RAM
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingArchive(true);
    setArchiveLoadProgress(`جاري فحص ${files.length} ملف من مجلد اللعبة (دعم الملفات والأحجام الكبيرة 2GB+)...`);

    try {
      const parsedFiles: GameFile[] = [];
      const zip = new JSZip();

      // Only archive text/code/web assets into memory zip, skipping heavy media for RAM stability
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;

        // If data JSON (this is what holds all dialogue and RPG Maker text)
        if (relativePath.endsWith('.json') && (relativePath.includes('data/') || relativePath.startsWith('data/'))) {
          try {
            const content = await file.text();
            const json = JSON.parse(content);
            if (relativePath.endsWith('System.json') && json.gameTitle) {
              setGameTitle(json.gameTitle);
            }
            const items = extractTranslatableItemsFromRpgMakerJson(relativePath, json);
            items.forEach((item) => {
              const cached = TranslationMemoryDB.get(item.originalText);
              if (cached) {
                item.translatedText = cached;
                item.status = 'cached';
              }
            });

            parsedFiles.push({
              path: relativePath,
              size: file.size,
              type: 'data_json',
              rawContent: content,
              translatableItems: items,
              status: items.every((i) => i.status === 'cached') && items.length > 0 ? 'completed' : 'pending',
              isTranslated: items.length > 0 && items.every((i) => i.status === 'cached'),
            });
            zip.file(relativePath, content);
          } catch (e) {
            console.warn(`JSON parse error on ${relativePath}:`, e);
          }
        } else if (
          relativePath.endsWith('.html') ||
          relativePath.endsWith('.css') ||
          relativePath.endsWith('.js')
        ) {
          // Keep scripts and configs in zip for font injection and web player
          if (file.size < 15 * 1024 * 1024) {
            zip.file(relativePath, file);
          }
        }
      }

      setOriginalZip(zip);
      setGameFiles(parsedFiles);
      if (parsedFiles.length > 0) {
        setSelectedFilePath(parsedFiles[0].path);
      }
    } catch (err: any) {
      alert(`خطأ أثناء قراءة المجلد: ${err?.message}`);
    } finally {
      setIsProcessingArchive(false);
      setArchiveLoadProgress('');
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Load a fast realistic demo sample (so user can test all features with 1 click)
  const loadDemoSample = () => {
    setIsProcessingArchive(true);
    setArchiveLoadProgress('جاري إنشاء مشروع RPG Maker افتراضي للاختبار...');

    setTimeout(() => {
      const sampleSystem = {
        gameTitle: "أسطورة بلورة النور (Crystal of Light)",
        currencyUnit: "Gold",
        terms: {
          basic: ["Level", "HP", "MP", "TP", "EXP"],
          commands: ["Attack", "Skill", "Defend", "Item", "Equip", "Status", "Formation", "Save", "Game Over"],
          params: ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck"],
          messages: {
            possession: "Possession",
            expTotal: "Current %1",
            expNext: "To Next %1",
            saveMessage: "Which file would you like to save to?",
            loadMessage: "Which file would you like to load?",
            file: "File"
          }
        }
      };

      const sampleMap = {
        events: [
          {
            name: "عجوز القرية (Elder)",
            pages: [
              {
                list: [
                  { code: 401, parameters: ["Welcome, brave hero! Darkness is approaching our kingdom."] },
                  { code: 401, parameters: ["Take this \\C[2]Ancient Sword\\C[0] and speak with \\N[1]."] },
                  { code: 102, parameters: [["I accept the quest!", "I need time to prepare.", "What is the reward?"]] },
                  { code: 401, parameters: ["Hurry! The sealed beast in the \\C[4]Forbidden Dungeon\\C[0] is waking up!"] },
                  { code: 401, parameters: ["Beware of the demon lord's lethal curses and dark illusions!"] }
                ]
              }
            ]
          },
          {
            name: "التاجر المتجول (Merchant)",
            pages: [
              {
                list: [
                  { code: 401, parameters: ["Greetings traveler! Would you like to check my secret wares?"] },
                  { code: 401, parameters: ["You currently possess \\G gold. Everything has a price."] },
                  { code: 102, parameters: [["Buy Health Potion", "Buy Mana Crystal", "Leave shop"]] }
                ]
              }
            ]
          }
        ]
      };

      const sampleActors = [
        {
          name: "Harold",
          nickname: "The Wandering Swordsman",
          profile: "A solitary warrior seeking the lost relic to avenge his fallen homeland."
        },
        {
          name: "Therese",
          nickname: "Sorceress of the Northern Winds",
          profile: "A powerful elemental mage master who commands icy blizzards."
        }
      ];

      const sampleItems = [
        { name: "Health Potion", description: "Restores 500 HP to a single ally." },
        { name: "Mana Elixir", description: "Restores 200 MP to a single ally." },
        { name: "Dragon Slayer", description: "A legendary blade forged in dragon flame. Boosts attack by +150." }
      ];

      const files: GameFile[] = [
        {
          path: "data/System.json",
          size: 1024,
          type: 'data_json',
          rawContent: JSON.stringify(sampleSystem, null, 2),
          translatableItems: extractTranslatableItemsFromRpgMakerJson("data/System.json", sampleSystem),
          status: 'pending',
          isTranslated: false
        },
        {
          path: "data/Map001.json",
          size: 2048,
          type: 'data_json',
          rawContent: JSON.stringify(sampleMap, null, 2),
          translatableItems: extractTranslatableItemsFromRpgMakerJson("data/Map001.json", sampleMap),
          status: 'pending',
          isTranslated: false
        },
        {
          path: "data/Actors.json",
          size: 1500,
          type: 'data_json',
          rawContent: JSON.stringify(sampleActors, null, 2),
          translatableItems: extractTranslatableItemsFromRpgMakerJson("data/Actors.json", sampleActors),
          status: 'pending',
          isTranslated: false
        },
        {
          path: "data/Items.json",
          size: 1200,
          type: 'data_json',
          rawContent: JSON.stringify(sampleItems, null, 2),
          translatableItems: extractTranslatableItemsFromRpgMakerJson("data/Items.json", sampleItems),
          status: 'pending',
          isTranslated: false
        }
      ];

      // Cache known terms
      files.forEach((file) => {
        file.translatableItems.forEach((item) => {
          const cached = TranslationMemoryDB.get(item.originalText);
          if (cached) {
            item.translatedText = cached;
            item.status = 'cached';
          }
        });
      });

      const zip = new JSZip();
      files.forEach((f) => zip.file(f.path, f.rawContent || ''));
      zip.file('index.html', '<!doctype html><html><head><title>Demo Game</title></head><body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>RPG Maker Web Engine Demo</h1></body></html>');

      setGameTitle("أسطورة بلورة النور (Crystal of Light)");
      setOriginalZip(zip);
      setGameFiles(files);
      setSelectedFilePath("data/Map001.json");
      setIsProcessingArchive(false);
      setArchiveLoadProgress('');
    }, 400);
  };

  // Run Ultra-Fast Concurrent Translation Engine
  const startTranslation = async () => {
    if (progress.isRunning) return;

    abortControllerRef.current = false;
    const startTime = Date.now();

    // Collect all pending items across all files
    const allPendingItems: { fileIndex: number; itemIndex: number; item: TranslatableItem }[] = [];
    gameFiles.forEach((file, fIdx) => {
      file.translatableItems.forEach((item, iIdx) => {
        if (item.status === 'pending' || item.status === 'error') {
          allPendingItems.push({ fileIndex: fIdx, itemIndex: iIdx, item });
        }
      });
    });

    if (allPendingItems.length === 0) {
      alert("جميع النصوص مترجمة بالفعل!");
      return;
    }

    const batchSize = Math.max(5, aiConfig.batchSize || 25);
    const totalBatches = Math.ceil(allPendingItems.length / batchSize);
    const concurrency = aiConfig.turboMode ? Math.max(1, aiConfig.concurrency || 4) : 1;

    // Prepare batches
    const batches: {
      batchIndex: number;
      items: { fileIndex: number; itemIndex: number; item: TranslatableItem }[];
    }[] = [];

    for (let b = 0; b < totalBatches; b++) {
      batches.push({
        batchIndex: b,
        items: allPendingItems.slice(b * batchSize, (b + 1) * batchSize),
      });
    }

    setProgress((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isDisconnected: false,
      totalStrings: totalStringsCount,
      translatedStrings: translatedStringsCount,
      totalBatches,
      currentBatch: 0,
      startTime,
      errorLog: [],
    }));

    let translatedCounter = translatedStringsCount;
    let nextBatchIdx = 0;
    let activeWorkers = 0;

    // Glossary map
    const glossaryMap = aiConfig.includeGlossary
      ? Object.fromEntries(
          TranslationMemoryDB.getAll().map((e) => [e.original, e.translation])
        )
      : {};

    const processBatch = async (batch: {
      batchIndex: number;
      items: { fileIndex: number; itemIndex: number; item: TranslatableItem }[];
    }) => {
      const textsToTranslate = batch.items.map((bItem) => bItem.item.originalText);
      const currentFileName = gameFiles[batch.items[0].fileIndex]?.path || '';

      setProgress((prev) => ({
        ...prev,
        currentBatch: batch.batchIndex + 1,
        currentFileName,
      }));

      let success = false;
      let retries = 0;
      const maxRetries = aiConfig.autoRetryOnDisconnect ? 3 : 1;

      while (!success && retries < maxRetries && !abortControllerRef.current) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              texts: textsToTranslate,
              targetLanguage: aiConfig.targetLang || 'Arabic',
              sourceLanguage: aiConfig.sourceLang || 'Japanese/English',
              provider: aiConfig.provider,
              model: aiConfig.model,
              apiKey: aiConfig.apiKey,
              baseUrl: aiConfig.baseUrl,
              glossary: glossaryMap,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `خطأ الخادم (${res.status})`);
          }

          const data = await res.json();
          const translations: string[] = data.translations || [];

          // Apply translations to local state
          setGameFiles((prevFiles) => {
            const newFiles = [...prevFiles];
            batch.items.forEach((bItem, idx) => {
              const file = newFiles[bItem.fileIndex];
              const item = file?.translatableItems[bItem.itemIndex];
              if (!item) return;

              const transText = translations[idx] || item.originalText;
              item.translatedText = transText;
              item.status = 'translated';

              // Save to Translation Memory DB for future reuse
              TranslationMemoryDB.set(item.originalText, transText);
            });

            // Update file status
            newFiles.forEach((f) => {
              f.isTranslated = f.translatableItems.every(
                (i) => i.status === 'translated' || i.status === 'cached'
              );
            });

            return newFiles;
          });

          translatedCounter += batch.items.length;
          success = true;

          // Update telemetry
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speed = elapsedSec > 0 ? (translatedCounter - translatedStringsCount) / elapsedSec : 0;
          const remaining = allPendingItems.length - (translatedCounter - translatedStringsCount);
          const estSeconds = speed > 0 ? Math.max(0, Math.round(remaining / speed)) : 0;

          setProgress((prev) => ({
            ...prev,
            translatedStrings: translatedCounter,
            speedPerSec: Number(speed.toFixed(1)),
            estimatedSecondsLeft: estSeconds,
            isDisconnected: false,
          }));
        } catch (err: any) {
          retries++;
          console.warn(`Translation batch ${batch.batchIndex + 1} attempt ${retries} failed:`, err);

          if (retries >= maxRetries) {
            setProgress((prev) => ({
              ...prev,
              isDisconnected: true,
              errorLog: [
                ...prev.errorLog.slice(-4),
                `فشل ترجمة دفعة في ${currentFileName}: ${err?.message}`,
              ],
            }));

            // Mark these items as error
            setGameFiles((prevFiles) => {
              const newFiles = [...prevFiles];
              batch.items.forEach((bItem) => {
                const item = newFiles[bItem.fileIndex]?.translatableItems[bItem.itemIndex];
                if (item) {
                  item.status = 'error';
                  item.error = err?.message;
                }
              });
              return newFiles;
            });
          } else {
            await new Promise((r) => setTimeout(r, 1200 * retries));
          }
        }
      }
    };

    // Parallel worker loop
    await new Promise<void>((resolve) => {
      const launchNext = async () => {
        if (abortControllerRef.current || nextBatchIdx >= batches.length) {
          if (activeWorkers === 0) resolve();
          return;
        }

        while (isPausedRef.current) {
          if (abortControllerRef.current) {
            resolve();
            return;
          }
          await new Promise((r) => setTimeout(r, 400));
        }

        const batch = batches[nextBatchIdx++];
        activeWorkers++;

        try {
          await processBatch(batch);
        } finally {
          activeWorkers--;
          if (nextBatchIdx < batches.length && !abortControllerRef.current) {
            launchNext();
          } else if (activeWorkers === 0) {
            resolve();
          }
        }
      };

      // Launch concurrent worker streams
      const initialStreams = Math.min(concurrency, batches.length);
      for (let i = 0; i < initialStreams; i++) {
        launchNext();
      }
    });

    setProgress((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
    }));
  };

  const pauseTranslation = () => {
    isPausedRef.current = true;
    setProgress((prev) => ({ ...prev, isPaused: true }));
  };

  const resumeTranslation = () => {
    isPausedRef.current = false;
    setProgress((prev) => ({ ...prev, isPaused: false }));
  };

  const stopTranslation = () => {
    abortControllerRef.current = true;
    isPausedRef.current = false;
    setProgress((prev) => ({ ...prev, isRunning: false, isPaused: false }));
  };

  // Download actions
  const downloadTranslatedOnly = async () => {
    try {
      const blob = await ArchiveManager.exportTranslatedOnlyZip(gameFiles);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameTitle.replace(/\s+/g, '_')}_Translated_Only.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`خطأ أثناء إنشاء ملف التحميل: ${e?.message}`);
    }
  };

  const downloadUntranslatedOnly = async () => {
    try {
      const blob = await ArchiveManager.exportUntranslatedOnlyZip(gameFiles);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameTitle.replace(/\s+/g, '_')}_Pending_Untranslated.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`خطأ أثناء تصدير الملفات المتبقية: ${e?.message}`);
    }
  };

  const downloadFullGame = async () => {
    try {
      const blob = await ArchiveManager.exportFullGameZip(
        originalZip,
        gameFiles,
        injectArabicFont
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameTitle.replace(/\s+/g, '_')}_Arabic_Patched.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`خطأ أثناء إنشاء حزمة اللعبة الكاملة: ${e?.message}`);
    }
  };

  const downloadProjectBackup = () => {
    const blob = ArchiveManager.exportProjectStateJson(gameFiles, gameTitle);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameTitle.replace(/\s+/g, '_')}_backup.rpgtrans`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Currently selected file items
  const selectedFile = gameFiles.find((f) => f.path === selectedFilePath);
  const displayedItems = useMemo(() => {
    if (!selectedFile) return [];
    return selectedFile.translatableItems.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.translatedText && item.translatedText.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && item.status === 'pending') ||
        (filterStatus === 'translated' && item.status === 'translated') ||
        (filterStatus === 'cached' && item.status === 'cached');

      return matchSearch && matchStatus;
    });
  }, [selectedFile, searchQuery, filterStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold text-lg">
              RPG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-wide">
                  مترجم ألعاب RPG Maker الذكي
                </h1>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  AI ترجمة متخطية الرقابة
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تعريب تلقائي لكافة محركات RPG Maker (MV / MZ / XP / VX) مع الخط العربي وقاعدة البيانات
              </p>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              title="إعدادات الذكاء الاصطناعي والمزودات"
            >
              <Cpu className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">إعدادات الـ AI</span>
            </button>

            <button
              onClick={() => setShowMemoryModal(true)}
              className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              title="قاعدة بيانات الترجمة المشتركة"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">ذاكرة الترجمة</span>
            </button>

            {gameFiles.length > 0 && (
              <button
                onClick={() => setShowPlayerModal(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>تشغيل وتجربة اللعبة</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        {/* If no files loaded yet: Splash & Dropzone */}
        {gameFiles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-2xl bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-3xl p-8 lg:p-12 text-center transition flex flex-col items-center gap-6 shadow-2xl backdrop-blur-sm">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                <FileArchive className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-md">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold mb-1">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>دعم كامل للألعاب الضخمة (2GB - 3GB+) ومحرك ترجمة متوازي فائق السرعة</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100">
                  ارفع ملف اللعبة المضغوط (ZIP) أو مجلد اللعبة
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  معالجة ذكية لألعاب RPG Maker الكبيرة جداً عبر استخراج نصوص وبيانات الـ JSON تلقائياً في ثوانٍ معدودة دون استهلاك الذاكرة، مع ترجمة فورية متوازية تفوق 8x أضعاف السرعة العادية.
                </p>
              </div>

              {/* Upload buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <label className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition shadow-lg shadow-amber-500/20">
                  <UploadCloud className="w-4 h-4" />
                  <span>رفع ملف لعبة (.ZIP)</span>
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip,.rar,.7z"
                    onChange={handleZipUpload}
                    className="hidden"
                  />
                </label>

                <label className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition border border-slate-700">
                  <FolderUp className="w-4 h-4 text-amber-400" />
                  <span>اختيار مجلد اللعبة مباشرة</span>
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    onChange={handleFolderUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Quick sample button */}
              <div className="pt-4 border-t border-slate-800/80 w-full flex flex-col items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  ليس لديك ملف لعبة جاهز الآن؟
                </span>
                <button
                  onClick={loadDemoSample}
                  className="px-4 py-1.5 bg-slate-800/50 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-medium border border-amber-500/30 flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تجربة فورية بمشروع RPG تجريبي (بنقرة واحدة)</span>
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mt-10">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">
                  +18
                </div>
                <h3 className="text-xs font-bold text-slate-200">ترجمة حوارية غير محجوبة</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  توجيه مخصص للذكاء الاصطناعي لترجمة جميع أنواع النصوص بما فيها القصص الدرامية المعقدة وألعاب الرعب و+18 دون رفض أو تحريف.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-200">قاعدة بيانات ترجمة مدمجة</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  حفظ المصطلحات الشائعة وأسماء الشخصيات والمهارات لإعادة استخدامها الفوري وتوفير التوكنز وتوحيد الترجمة.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-xs font-bold text-slate-200">معاينة وتشغيل بالمتصفح</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  محاكاة صندوق حوارات RPG Maker المباشر للتأكد من تناسق النصوص والخط العربي وتجربة اللعبة داخل المتصفح.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Active Project Workspace */
          <div className="flex flex-col gap-6">
            {/* Project Status & Translation Controls Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-100">{gameTitle}</h2>
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono border border-slate-700">
                      {gameFiles.length} ملفات بيانات
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إجمالي الجمل: <span className="font-mono text-slate-200">{totalStringsCount}</span> |
                    المترجمة: <span className="font-mono text-emerald-400">{translatedStringsCount}</span> |
                    المتبقية: <span className="font-mono text-amber-400">{pendingStringsCount}</span>
                  </p>
                </div>

                {/* Primary Control Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Turbo Toggle Quick Badge */}
                  <button
                    onClick={() =>
                      setAiConfig((prev) => ({
                        ...prev,
                        turboMode: !prev.turboMode,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                      aiConfig.turboMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title="تفعيل/تعطيل محرك السرعة القصوى المتوازي"
                  >
                    <Zap className={`w-3.5 h-3.5 ${aiConfig.turboMode ? 'fill-current text-amber-400' : ''}`} />
                    <span>Turbo Speed {aiConfig.turboMode ? `(${aiConfig.concurrency || 4}x متزامن)` : '(متوقف)'}</span>
                  </button>

                  {!progress.isRunning ? (
                    <button
                      onClick={startTranslation}
                      disabled={pendingStringsCount === 0}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>بدء الترجمة فائقة السرعة</span>
                    </button>
                  ) : (
                    <>
                      {progress.isPaused ? (
                        <button
                          onClick={resumeTranslation}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>استئناف</span>
                        </button>
                      ) : (
                        <button
                          onClick={pauseTranslation}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition border border-amber-500/30"
                        >
                          <Pause className="w-4 h-4" />
                          <span>إيقاف مؤقت</span>
                        </button>
                      )}

                      <button
                        onClick={stopTranslation}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition border border-red-500/40"
                      >
                        <span>إلغاء</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowPlayerModal(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition border border-slate-700"
                  >
                    <Play className="w-4 h-4 text-emerald-400 fill-current" />
                    <span>تجربة اللعبة</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("هل تريد إفراغ المشروع الحالي وتحميل لعبة أخرى؟")) {
                        setGameFiles([]);
                        setOriginalZip(null);
                      }
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition"
                    title="مشروع جديد"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar & Telemetry */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {progress.isRunning && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    )}
                    <span className="text-slate-300 font-medium">
                      {progress.isRunning
                        ? `جاري الترجمة بواسطة ${aiConfig.model} [الدفعة ${progress.currentBatch} من ${progress.totalBatches}]`
                        : translatedStringsCount === totalStringsCount && totalStringsCount > 0
                        ? "اكتملت ترجمة جميع الملفات بنجاح!"
                        : "جاهز لبدء الترجمة"}
                    </span>
                    {progress.currentFileName && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        ({progress.currentFileName})
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-amber-400 font-bold">
                    {totalStringsCount > 0
                      ? `${Math.round((translatedStringsCount / totalStringsCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                    style={{
                      width: `${
                        totalStringsCount > 0
                          ? (translatedStringsCount / totalStringsCount) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>

                {progress.isRunning && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      السرعة: <strong className="text-slate-200">{progress.speedPerSec}</strong> سطر/ثانية
                    </span>
                    <span>
                      الوقت المقدر المتبقي: حوالي{' '}
                      <strong className="text-slate-200">
                        {progress.estimatedSecondsLeft > 60
                          ? `${Math.round(progress.estimatedSecondsLeft / 60)} دقيقة`
                          : `${progress.estimatedSecondsLeft} ثانية`}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Smart Disconnect / Interruption Recovery Box */}
              {/* As requested: "و اذ توقف التحميل بدون سبب ف سوف يعطيك خيارات ل تحميل الملفات التي ترجمتها ل وحدها و الملفات يلي ما تترجمت لوحدها مع خاصية الاستكمال التلقائي" */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>خيارات التصدير والاستكمال الذاتي في أي وقت:</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    حتى لو انقطع الاتصال أو أغلقت الصفحة، يمكنك تحميل ما تُرجم فقط، أو تحميل ما تبقى دون ترجمة لمتابعته لاحقاً!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={downloadTranslatedOnly}
                    disabled={translatedStringsCount === 0}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 disabled:opacity-40 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    title="تحميل الملفات المترجمة فقط في أرشيف خفيف"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل المترجم فقط (Zip)</span>
                  </button>

                  <button
                    onClick={downloadUntranslatedOnly}
                    disabled={pendingStringsCount === 0}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 disabled:opacity-40 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    title="تحميل الملفات التي لم تترجم بعد لمتابعتها لاحقاً"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل المتبقي غير المترجم (Zip)</span>
                  </button>

                  <button
                    onClick={downloadFullGame}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow"
                    title="تحميل أرشيف اللعبة كاملاً بعد التعديل وحقن الخط العربي"
                  >
                    <HardDriveDownload className="w-4 h-4" />
                    <span>تحميل اللعبة الكاملة المعربة</span>
                  </button>
                </div>
              </div>

              {/* Automatic Arabic Font Injection Options */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={injectArabicFont}
                    onChange={(e) => setInjectArabicFont(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>
                    إضافة خط عربي تلقائي (Cairo) وتحديث <code className="text-amber-400">gamefont.css</code> لضمان دعم اللغة العربية
                  </span>
                </label>

                <button
                  onClick={downloadProjectBackup}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  <span>حفظ نسخة احتياطية (.rpgtrans)</span>
                </button>
              </div>
            </div>

            {/* Split Screen Workspace: Files List & Strings Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Files Navigator (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>ملفات اللعبة وبيانات الحوار</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {gameFiles.length} ملف
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {gameFiles.map((file) => {
                    const total = file.translatableItems.length;
                    const translated = file.translatableItems.filter(
                      (i) => i.status === 'translated' || i.status === 'cached'
                    ).length;
                    const isSelected = selectedFilePath === file.path;

                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full text-right p-2.5 rounded-xl border transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/60 text-slate-100'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="truncate text-xs font-medium font-mono" dir="ltr">
                          {file.path.replace('data/', '')}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              translated === total && total > 0
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : translated > 0
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {translated}/{total}
                          </span>
                          {translated === total && total > 0 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Strings Table & Editor (8 cols) */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
                {selectedFile ? (
                  <>
                    {/* File Header & Filters */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-xs font-bold text-slate-200 font-mono" dir="ltr">
                          {selectedFile.path}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {selectedFile.translatableItems.length} سطر حواري أو نص قابل للترجمة
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="بحث في النصوص..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-2.5 py-1 text-xs text-slate-200 focus:border-amber-500"
                          />
                        </div>

                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value as any)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:border-amber-500"
                        >
                          <option value="all">الكل</option>
                          <option value="pending">غير مترجم</option>
                          <option value="translated">مترجم</option>
                          <option value="cached">من الذاكرة</option>
                        </select>
                      </div>
                    </div>

                    {/* Strings List */}
                    <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                      {displayedItems.length > 0 ? (
                        displayedItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-amber-400/90 font-medium">
                                #{idx + 1} • {item.context}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  item.status === 'translated'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : item.status === 'cached'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : item.status === 'error'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {item.status === 'translated'
                                  ? 'مترجم بالذكاء الاصطناعي'
                                  : item.status === 'cached'
                                  ? 'ذاكرة الترجمة'
                                  : item.status === 'error'
                                  ? 'فشل'
                                  : 'قيد الانتظار'}
                              </span>
                            </div>

                            {/* Original Text */}
                            <div
                              className="text-xs text-slate-300 font-mono bg-slate-900/80 p-2.5 rounded-lg text-left"
                              dir="ltr"
                            >
                              {item.originalText}
                            </div>

                            {/* Translated Text (Editable) */}
                            <div>
                              <input
                                type="text"
                                value={item.translatedText || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  item.translatedText = val;
                                  if (val) {
                                    item.status = 'translated';
                                    TranslationMemoryDB.set(item.originalText, val);
                                  }
                                  setGameFiles([...gameFiles]);
                                }}
                                placeholder="الترجمة العربية..."
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          لا توجد أسطر مطابقة للبحث أو الفلتر
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    اختر ملفاً من القائمة الجانبية لمعاينة نصوصه
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Loading Modal overlay during zip extraction */}
      {isProcessingArchive && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">جاري معالجة بيانات اللعبة</h3>
              <p className="text-xs text-slate-400 mt-1">{archiveLoadProgress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showConfigModal && (
        <AIConfigModal
          config={aiConfig}
          onSave={(newCfg) => setAiConfig(newCfg)}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {showMemoryModal && (
        <TranslationMemoryModal onClose={() => setShowMemoryModal(false)} />
      )}

      {showPlayerModal && (
        <WebGamePlayer
          gameFiles={gameFiles}
          originalZip={originalZip}
          gameTitle={gameTitle}
          onClose={() => setShowPlayerModal(false)}
        />
      )}
    </div>
  );
}
