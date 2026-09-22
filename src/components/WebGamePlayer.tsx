/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Play, RotateCcw, Volume2, Maximize2, Sparkles, MessageSquare, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';
import { GameFile, TranslatableItem } from '../types';
import JSZip from 'jszip';

interface WebGamePlayerProps {
  gameFiles: GameFile[];
  originalZip: JSZip | null;
  gameTitle: string;
  onClose: () => void;
}

export const WebGamePlayer: React.FC<WebGamePlayerProps> = ({
  gameFiles,
  originalZip,
  gameTitle,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'dialogue_preview' | 'full_game'>('dialogue_preview');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [dialogueIndex, setDialogueIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(18);
  const [windowTone, setWindowTone] = useState<string>('rgba(20, 24, 40, 0.92)');
  const [fullGameUrl, setFullGameUrl] = useState<string | null>(null);
  const [fullGameError, setFullGameError] = useState<string | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState<boolean>(false);

  // Filter files that have translatable dialogue
  const mapAndEventFiles = useMemo(() => {
    return gameFiles.filter((f) => f.translatableItems.length > 0);
  }, [gameFiles]);

  useEffect(() => {
    if (mapAndEventFiles.length > 0 && !selectedFile) {
      setSelectedFile(mapAndEventFiles[0].path);
    }
  }, [mapAndEventFiles, selectedFile]);

  const currentFileItems = useMemo(() => {
    const file = gameFiles.find((f) => f.path === selectedFile);
    return file ? file.translatableItems : [];
  }, [gameFiles, selectedFile]);

  const currentItem: TranslatableItem | undefined = currentFileItems[dialogueIndex];

  // Try preparing full game HTML if index.html exists in zip
  const hasIndexHtml = useMemo(() => {
    return originalZip ? Boolean(originalZip.file('index.html')) : false;
  }, [originalZip]);

  const launchFullGame = async () => {
    if (!originalZip) {
      setFullGameError("ملف اللعبة المضغوط غير محمل في الذاكرة لتشغيل النسخة الكاملة.");
      return;
    }
    setIsLoadingGame(true);
    setFullGameError(null);

    try {
      const indexFile = originalZip.file('index.html');
      if (!indexFile) {
        throw new Error("لم يتم العثور على index.html في ملفات اللعبة (قد تكون لعبة RPG Maker XP/VX قديمة لا تعمل عبر HTML5).");
      }

      // Generate a blob URL for index.html with inline scripts/styles if possible
      let indexHtml = await indexFile.async('string');
      // Inject base or cdn font
      indexHtml = indexHtml.replace(
        '<head>',
        `<head><base href="${window.location.href}"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"><style>* { font-family: 'Cairo', sans-serif !important; }</style>`
      );

      const blob = new Blob([indexHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setFullGameUrl(url);
    } catch (err: any) {
      setFullGameError(err?.message || "تعذر تشغيل اللعبة في المتصفح.");
    } finally {
      setIsLoadingGame(false);
    }
  };

  // Helper to parse RPG Maker control codes for visual preview
  const renderRpgMakerCodes = (text: string) => {
    if (!text) return text;
    // Replace \C[n] with colored text
    let parsed = text
      .replace(/\\C\[0\]/g, '</span>')
      .replace(/\\C\[1\]/g, '<span style="color: #60a5fa;">')
      .replace(/\\C\[2\]/g, '<span style="color: #f87171;">')
      .replace(/\\C\[3\]/g, '<span style="color: #4ade80;">')
      .replace(/\\C\[4\]/g, '<span style="color: #38bdf8;">')
      .replace(/\\C\[5\]/g, '<span style="color: #c084fc;">')
      .replace(/\\C\[6\]/g, '<span style="color: #facc15;">')
      .replace(/\\C\[\d+\]/g, '<span style="color: #f59e0b;">')
      .replace(/\\N\[\d+\]/g, '<strong style="color: #38bdf8;">[اسم البطل]</strong>')
      .replace(/\\V\[\d+\]/g, '<em style="color: #a78bfa;">[متغير]</em>')
      .replace(/\\G/g, '<span style="color: #f59e0b;">[ذهب]</span>')
      .replace(/\\!|\\\. |\\\||\\>|\\<|\\\^/g, '');

    return <span dangerouslySetInnerHTML={{ __html: parsed }} />;
  };

  return (
    <div id="web-game-player-modal" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                تجربة وتشغيل اللعبة في المتصفح
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  محاكي RPG Maker
                </span>
              </h2>
              <p className="text-xs text-slate-400">{gameTitle || "مشروع RPG Maker"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dialogue_preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'dialogue_preview'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              معاينة الحوارات وصندوق النصوص
            </button>
            {hasIndexHtml && (
              <button
                onClick={() => {
                  setActiveTab('full_game');
                  if (!fullGameUrl) launchFullGame();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'full_game'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                تشغيل محرك اللعبة (HTML5)
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
              title="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden bg-slate-950/60 p-6 flex flex-col">
          {activeTab === 'dialogue_preview' ? (
            <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {/* Controls bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400">اختر الملف:</label>
                  <select
                    value={selectedFile}
                    onChange={(e) => {
                      setSelectedFile(e.target.value);
                      setDialogueIndex(0);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {mapAndEventFiles.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path} ({f.translatableItems.length} سطر)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">حجم الخط:</span>
                  <input
                    type="range"
                    min="14"
                    max="28"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-24 accent-amber-500"
                  />
                  <span className="text-xs text-slate-300 w-6">{fontSize}px</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDialogueIndex((prev) => Math.max(0, prev - 1))}
                    disabled={dialogueIndex === 0}
                    className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    title="السابق"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-400">
                    {currentFileItems.length > 0 ? dialogueIndex + 1 : 0} / {currentFileItems.length}
                  </span>
                  <button
                    onClick={() =>
                      setDialogueIndex((prev) => Math.min(currentFileItems.length - 1, prev + 1))
                    }
                    disabled={dialogueIndex >= currentFileItems.length - 1}
                    className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    title="التالي"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* RPG Maker Window Screen Simulator */}
              <div className="flex-1 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl relative overflow-hidden flex flex-col justify-end p-8 shadow-inner shadow-black">
                {/* Background Game Scene Graphic Art */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-slate-500">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>محاكاة نافذة الحوار الرسمية (Window_Message) مع خط Cairo المعرب</span>
                </div>

                {currentItem ? (
                  <div className="space-y-4 relative z-10">
                    {/* Speaker Header if available */}
                    <div className="text-xs text-amber-400 font-semibold flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{currentItem.context}</span>
                    </div>

                    {/* The Classic RPG Maker Message Window Box */}
                    <div
                      style={{
                        backgroundColor: windowTone,
                        fontSize: `${fontSize}px`,
                        fontFamily: "'Cairo', sans-serif",
                      }}
                      className="border-4 border-slate-400/60 rounded-xl p-6 shadow-2xl text-slate-50 min-h-[140px] flex flex-col justify-center leading-relaxed transition-all"
                    >
                      {/* Arabic Translated Text with Control Code highlights */}
                      <div className="text-right whitespace-pre-wrap font-medium">
                        {currentItem.translatedText ? (
                          renderRpgMakerCodes(currentItem.translatedText)
                        ) : (
                          <span className="text-slate-400 italic">
                            (لم تتم ترجمة هذا السطر بعد - النص الأصلي أدناه)
                          </span>
                        )}
                      </div>

                      {/* Original Source Reference */}
                      <div className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-slate-400 text-left font-mono" dir="ltr">
                        <span className="text-amber-400/80 font-bold mr-2">ORIGINAL:</span>
                        {currentItem.originalText}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-500">
                    لا توجد حوارات في هذا الملف المحدد
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              {isLoadingGame ? (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-slate-300 text-sm">جاري تشغيل محرك اللعبة في نافذة معزولة...</p>
                </div>
              ) : fullGameError ? (
                <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl max-w-md text-center space-y-3">
                  <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
                  <p className="text-red-300 text-sm">{fullGameError}</p>
                  <button
                    onClick={() => setActiveTab('dialogue_preview')}
                    className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-xs hover:bg-slate-700"
                  >
                    العودة إلى معاين الحوارات
                  </button>
                </div>
              ) : fullGameUrl ? (
                <iframe
                  src={fullGameUrl}
                  title="RPG Maker Web Runner"
                  className="w-full h-full rounded-xl border border-slate-800 bg-black"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <button
                  onClick={launchFullGame}
                  className="px-6 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  بدء تشغيل اللعبة
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
