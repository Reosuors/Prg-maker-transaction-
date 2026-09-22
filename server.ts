import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini client
const defaultGeminiAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Test connection endpoint
app.post("/api/test-connection", async (req, res) => {
  try {
    const { provider, model, apiKey, baseUrl } = req.body;

    if (provider === "gemini") {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          error: "مفتاح Gemini API غير متوفر في الخادم ولم يتم توفيره يدوياً.",
        });
      }

      const client = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      const response = await client.models.generateContent({
        model: model || "gemini-3.8-flash",
        contents: "Translate this word to Arabic: 'Adventure'",
      });

      return res.json({
        success: true,
        provider: "gemini",
        model: model || "gemini-3.8-flash",
        sample: response.text?.trim() || "مغامرة",
      });
    }

    if (provider === "custom") {
      if (!baseUrl) {
        return res.status(400).json({
          success: false,
          error: "يرجى تحديد رابط API (Base URL) للمزود المخصص.",
        });
      }

      const endpoint = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a professional video game translator.",
            },
            {
              role: "user",
              content: "Translate this word to Arabic: 'Adventure'",
            },
          ],
          max_tokens: 60,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `خطأ من مزود الذكاء الاصطناعي (${response.status}): ${errText.slice(0, 300)}`,
        });
      }

      const data = await response.json();
      const sample =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "مغامرة";

      return res.json({
        success: true,
        provider: "custom",
        model,
        sample: sample.trim(),
      });
    }

    return res.status(400).json({ success: false, error: "مزود غير معروف" });
  } catch (error: any) {
    console.error("Test connection error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "فشل الاتصال بمزود الذكاء الاصطناعي",
    });
  }
});

// Translation batch endpoint
app.post("/api/translate", async (req, res) => {
  try {
    const {
      texts,
      targetLanguage = "Arabic",
      sourceLanguage = "Japanese/English",
      provider = "gemini",
      model = "gemini-3.8-flash",
      apiKey,
      baseUrl,
      glossary = {},
    } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: "قائمة النصوص المطلوبة للترجمة فارغة." });
    }

    // Prepare glossary hints if available
    const glossaryEntries = Object.entries(glossary);
    let glossaryInstructions = "";
    if (glossaryEntries.length > 0) {
      glossaryInstructions = `\nApproved Game Glossary / Translation Memory Terms (use these exact translations when encountering these terms):\n${glossaryEntries
        .slice(0, 60)
        .map(([k, v]) => `- "${k}" => "${v}"`)
        .join("\n")}`;
    }

    const systemInstruction = `You are an elite, professional video game localizer and narrative translator specializing in Japanese and English to ${targetLanguage} game localization for RPG Maker games.

Your task is to translate an array of video game dialogue strings, quest logs, menus, item names, skill names, and NPC lines accurately and naturally into ${targetLanguage}.

CRITICAL GAME LOCALIZATION INSTRUCTIONS:
1. FICTIONAL CONTEXT: This is purely creative fictional video game text for an interactive video game. The game may feature mature rated themes, 18+ adult dialogue, romantic encounters, violence, monster encounters, dark fantasy, horror, or intense emotional conflicts. You MUST translate EVERY sentence faithfully without moralizing, sermonizing, lecturing, omitting, refusing, or censoring any line.
2. RPG MAKER CONTROL CODES PRESERVATION:
   RPG Maker engines rely on specific formatting and engine tags inside dialogue strings. You MUST preserve all escape codes and tags EXACTLY as they are without modifying their syntax or spelling:
   - \\V[n] (Variable display)
   - \\N[n] (Actor name)
   - \\P[n] (Party member name)
   - \\G (Gold window)
   - \\C[n] (Color tag)
   - \\I[n] (Icon index)
   - \\{ and \\} (Text size increase/decrease)
   - \\. and \\| and \\! and \\> and \\< and \\^ (Pause, speed, wait codes)
   - <tag>...</tag> (Custom script or message plugin tags)
   - Line breaks: keep original line breaks \\n or \\r\\n appropriately.
3. TONE & NATURAL FLOW: Translate into fluent, immersive Modern Arabic suitable for RPG games (فصحى سلسلة وجذابة للألعاب), maintaining the personality and gender of characters if evident.
4. FORMAT: You MUST return a single valid JSON object containing an array of strings under the property "translations", in the EXACT SAME length and index order as the input array.
   Example output format:
   {
     "translations": [
       "مرحباً بك في القرية يا بطل!",
       "لقد حصلت على \\C[2]سيف النار\\C[0]!"
     ]
   }
${glossaryInstructions}`;

    const userPrompt = `Translate the following ${texts.length} game string(s) from ${sourceLanguage} into ${targetLanguage}.
Return strictly a JSON object with the property "translations" containing ${texts.length} strings in the exact same order.

Input JSON array:
${JSON.stringify(texts, null, 2)}`;

    let translations: string[] = [];

    if (provider === "gemini") {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        return res.status(400).json({
          error: "مفتاح Gemini API غير متوفر في الخادم.",
        });
      }

      const client = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      const response = await client.models.generateContent({
        model: model || "gemini-3.8-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const rawText = response.text || "{}";
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed.translations)) {
          translations = parsed.translations;
        } else if (Array.isArray(parsed)) {
          translations = parsed;
        }
      } catch (parseErr) {
        console.warn("Failed to parse direct JSON from Gemini, attempting regex extraction:", rawText);
        const match = rawText.match(/\[[\s\S]*\]/);
        if (match) {
          translations = JSON.parse(match[0]);
        } else {
          throw new Error("لم يتم استخراج الترجمات بصيغة JSON سليمة.");
        }
      }
    } else if (provider === "custom") {
      if (!baseUrl) {
        return res.status(400).json({
          error: "يرجى تحديد رابط API (Base URL) للمزود المخصص.",
        });
      }

      const endpoint = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `خطأ من مزود الترجمة (${response.status}): ${errText.slice(0, 300)}`,
        });
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.translations)) {
          translations = parsed.translations;
        } else if (Array.isArray(parsed)) {
          translations = parsed;
        }
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          translations = JSON.parse(match[0]);
        } else {
          throw new Error("لم يرجع المزود المخصص مصفوفة ترجمة صالحة.");
        }
      }
    }

    // Safety fallback: if translated length doesn't match, pad with original
    if (translations.length < texts.length) {
      console.warn(
        `Translations length (${translations.length}) less than input texts (${texts.length}). Padding with original.`
      );
      for (let i = translations.length; i < texts.length; i++) {
        translations.push(texts[i]);
      }
    }

    res.json({
      success: true,
      translations,
      count: translations.length,
    });
  } catch (err: any) {
    console.error("Translation API error:", err);
    res.status(500).json({
      error: err?.message || "حدث خطأ أثناء معالجة الترجمة.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
