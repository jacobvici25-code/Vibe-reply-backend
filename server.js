const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── YOUR HUGGING FACE KEY ───────────────────────────────────────────────────
const HF_API_KEY = "YOUR_HUGGING_FACE_API_KEY_HERE";
const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// ─── PERSONA SYSTEM PROMPTS ──────────────────────────────────────────────────
const PERSONA_PROMPTS = {
  Casual: `You are a chill, friendly assistant that writes casual everyday replies.
Your replies sound like texting a close friend — relaxed, natural, no stiffness.
Use simple words, contractions, maybe a little humour. Keep it short and real.
Never sound robotic or formal. Just vibe.`,

  Business: `You are a professional communication assistant that writes sharp, polished business replies.
Your replies are confident, clear, and respectful — suitable for emails, LinkedIn, or workplace chats.
Use proper grammar. Be concise and direct. No slang or emojis.
Sound like a senior professional who respects people's time.`,

  Flirty: `You are a witty, warm, and charming assistant that writes playful flirty replies.
Your replies are fun, a little teasing, sweet but never inappropriate or explicit.
Use light humour, compliments, and warmth. Keep it tasteful and exciting.
Sound like someone confident and likeable who knows how to keep a conversation interesting.`,

  Aura: `You are a mysterious, cool, and unbothered assistant that writes high-aura replies.
Your replies are calm, confident, and slightly poetic — like someone who doesn't need to try hard.
Use minimal words with maximum impact. Be smooth, deep, and a little unpredictable.
Sound like the most interesting person in the room who speaks only when it matters.`,
};

// ─── TYPO / RUBBISH DETECTOR ─────────────────────────────────────────────────
function isRubbish(text) {
  const cleaned = text.trim();

  // Too short
  if (cleaned.length < 3) return true;

  // All same character repeated (e.g. hhhhhh, aaaaaaa, .........)
  if (/^(.)\1{4,}$/.test(cleaned)) return true;

  // Random keyboard mash — too many consecutive consonants or no vowels at all
  const vowels = (cleaned.match(/[aeiouAEIOU]/g) || []).length;
  const letters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (letters > 5 && vowels === 0) return true;

  // Ratio of unique chars too low (e.g. "asdasdasd")
  const unique = new Set(cleaned.toLowerCase().replace(/\s/g, "")).size;
  if (cleaned.length > 8 && unique <= 3) return true;

  // Only special chars or numbers with no real words
  if (/^[^a-zA-Z]+$/.test(cleaned) && cleaned.length > 4) return true;

  return false;
}

// ─── CALL HUGGING FACE ───────────────────────────────────────────────────────
async function callHuggingFace(prompt) {
  const response = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
        temperature: 0.85,
        top_p: 0.92,
        do_sample: true,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Hugging Face error: ${err}`);
  }

  const data = await response.json();

  // HF returns array
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }

  throw new Error("Unexpected response format from Hugging Face");
}

// ─── /api/chat ROUTE ─────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, vibe, style } = req.body;

  // Basic validation
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  // Rubbish / typo check
  if (isRubbish(message)) {
    return res.status(200).json({
      reply:
        "⚠️ Hmm, that looks like a typo or random text. Please paste a real message so I can generate a proper reply for you!",
    });
  }

  // Pick persona (default to Casual)
  const persona = PERSONA_PROMPTS[style] || PERSONA_PROMPTS["Casual"];

  // Build the full prompt for Mistral instruct format
  const vibeInstruction = vibe && vibe.trim()
    ? `Additional instruction: ${vibe.trim()}`
    : "";

  const prompt = `<s>[INST] ${persona}

${vibeInstruction}

Now write a reply to this message:
"${message.trim()}"

Reply only with the message. No explanations, no labels, no quotation marks. Just the reply itself. [/INST]`;

  try {
    const reply = await callHuggingFace(prompt);

    // Clean up any leftover instruction leakage
    const cleaned = reply
      .replace(/^\[INST\].*?\[\/INST\]/gs, "")
      .replace(/^(Reply:|Assistant:|AI:)/i, "")
      .trim();

    return res.status(200).json({ reply: cleaned || reply });
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ Vibe Reply AI backend is running!" });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Vibe Reply AI backend running on port ${PORT}`);
});