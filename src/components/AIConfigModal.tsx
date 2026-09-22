/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Cpu, Key, Globe, Shield, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AIProviderConfig } from '../types';

interface AIConfigModalProps {
  config: AIProviderConfig;
  onSave: (newConfig: AIProviderConfig) => void;
  onClose: () => void;
}

export const AIConfigModal: React.FC<AIConfigModalProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<AIProviderConfig>({ ...config });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const presets = [
    {
      name: 'OpenRouter (نماذج متخطية الرقابة مفتوحة المصدر)',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    },
    {
      name: 'DeepSeek API',
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
    {
      name: 'Ollama (محلي على جهازك دون إنترنت)',
      baseUrl: 'http://localhost:11434/v1',
      defaultModel: 'llama3:latest',
    },
    {
      name: 'Groq (فائق السرعة)',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
    },
  ];

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formData.provider,
          model: formData.model,
          apiKey: formData.apiKey,
          baseUrl: formData.baseUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `تم الاتصال بنجاح! ترجمة تجريبية: "${data.sample}"`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'فشل الاتصال بمزود الذكاء الاصطناعي.',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'تعذر الوصول إلى الخادم للتحقق من الاتصال.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div id="ai-config-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">إعدادات محرك الذكاء الاصطناعي</h2>
              <p className="text-xs text-slate-400">
                اختر نموذج الذكاء الاصطناعي أو أدخل توكنك الخاص ونماذجك المخصصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">نوع المزود:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    provider: 'gemini',
                    model: 'gemini-3.8-flash',
                  })
                }
                className={`p-3 rounded-xl border text-right transition flex items-center gap-3 ${
                  formData.provider === 'gemini'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Zap className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs text-slate-100">Google Gemini (المدمج السريع)</div>
                  <div className="text-[11px] text-slate-400">سريع ومثالي لترجمة ألعاب RPG</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    provider: 'custom',
                    baseUrl: formData.baseUrl || 'https://openrouter.ai/api/v1',
                    model: formData.model || 'meta-llama/llama-3.3-70b-instruct',
                  })
                }
                className={`p-3 rounded-xl border text-right transition flex items-center gap-3 ${
                  formData.provider === 'custom'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Globe className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-xs text-slate-100">مزود مخصص / توكن شخصي</div>
                  <div className="text-[11px] text-slate-400">OpenRouter / Ollama / DeepSeek</div>
                </div>
              </button>
            </div>
          </div>

          {/* Configuration Fields */}
          {formData.provider === 'gemini' ? (
            <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">نموذج Gemini:</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (الأسرع والأدق للنصوص)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (تفكير عميق وأسلوب أدبي متقدم)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (خفيف واقتصادي)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 flex items-center justify-between">
                  <span>مفتاح Gemini API الشخصي (اختياري):</span>
                  <span className="text-[10px] text-slate-500">اتركه فارغاً لاستخدام المفتاح المدمج في الخادم</span>
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              {/* Presets buttons */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">قوالب جاهزة سريعة:</label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          baseUrl: p.baseUrl,
                          model: p.defaultModel,
                        })
                      }
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 hover:border-amber-500 transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">رابط الـ API (Base URL):</label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">اسم النموذج (Model ID):</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="meta-llama/llama-3.3-70b-instruct"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">التوكن / مفتاح الـ API الخاص بك:</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Localization & Safety System Prompt Info */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Shield className="w-4 h-4" />
              <span>وضع ترجمة الحوارات التفاعلي والكامل (بما يشمل ألعاب +18 والرعب والأكشن)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              يقوم النظام بتوجيه النموذج بدقة كمعرّب ألعاب فيديو محترف، مع الحفاظ الصارم على جميع علامات وأكواد تحكم محرك RPG Maker (مثل <code className="text-amber-300 font-mono">{"\\{ \\V[n] \\C[n] \\}"}</code>) دون إتلافها، وترجمة كافة الحوارات الدرامية أو الموجهة للكبار بأمانة سردية تامة دون حجب أو تحوير.
            </p>
          </div>

          {/* Advanced options */}
          <div className="space-y-3">
            {/* Turbo Ultra-Speed Mode */}
            <div className="flex items-center justify-between bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/30">
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 fill-current text-amber-400" />
                  <span>وضع الترجمة فائق السرعة (Turbo Speed Engine):</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  معالجة دفعات متزامنة في نفس اللحظة (Multi-threading) لتسريع الترجمة بمقدار 4 إلى 8 أضعاف
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.turboMode ?? true}
                onChange={(e) => setFormData({ ...formData, turboMode: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Concurrency slider */}
            <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">عدد الطلبات المتزامنة (Parallel Requests):</div>
                <div className="text-[11px] text-slate-400">كم دفعة يتم إرسالها لنموذج الذكاء الاصطناعي معاً (افتراضي: 4 طلبات متوازية)</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={formData.concurrency || 4}
                  onChange={(e) => setFormData({ ...formData, concurrency: Number(e.target.value) })}
                  className="w-24 accent-amber-500"
                />
                <span className="text-xs text-amber-400 font-mono font-bold w-6">{formData.concurrency || 4}x</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">حجم حزمة الترجمة في الدفعة الواحدة:</div>
                <div className="text-[11px] text-slate-400">عدد الأسطر المرسلة معاً في كل طلب (من 10 إلى 50 سطر)</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={formData.batchSize || 25}
                  onChange={(e) => setFormData({ ...formData, batchSize: Number(e.target.value) })}
                  className="w-24 accent-amber-500"
                />
                <span className="text-xs text-slate-300 font-mono w-6">{formData.batchSize || 25}</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">الاستكمال التلقائي عند انقطاع الاتصال:</div>
                <div className="text-[11px] text-slate-400">إعادة المحاولة والمتابعة من آخر نقطة في حال ضعف الشبكة</div>
              </div>
              <input
                type="checkbox"
                checked={formData.autoRetryOnDisconnect}
                onChange={(e) =>
                  setFormData({ ...formData, autoRetryOnDisconnect: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Test connection results */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>اختبار الاتصال</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-semibold transition"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold rounded-xl text-xs transition"
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
