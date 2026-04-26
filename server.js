const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── GROQ CONFIG ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

// ─── PERSONA PROMPTS ─────────────────────────────────────────────────────────
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

// ─── RUBBISH DETECTOR ────────────────────────────────────────────────────────
function isRubbish(text) {
  const cleaned = text.trim();
  if (cleaned.length < 3) return true;
  if (/^(.)\1{4,}$/.test(cleaned)) return true;
  const vowels = (cleaned.match(/[aeiouAEIOU]/g) || []).length;
  const letters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (letters > 5 && vowels === 0) return true;
  const unique = new Set(cleaned.toLowerCase().replace(/\s/g, "")).size;
  if (cleaned.length > 8 && unique <= 3) return true;
  if (/^[^a-zA-Z]+$/.test(cleaned) && cleaned.length > 4) return true;
  return false;
}

// ─── CALL GROQ ───────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userMessage) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.85,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

// ─── /api/chat ────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, vibe, style } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  if (isRubbish(message)) {
    return res.status(200).json({
      reply: "⚠️ That looks like a typo or random text. Please paste a real message so I can generate a proper reply!",
    });
  }

  const persona = PERSONA_PROMPTS[style] || PERSONA_PROMPTS["Casual"];
  const vibeInstruction = vibe && vibe.trim() ? `Additional instruction: ${vibe.trim()}` : "";
  
  const userPrompt = `${vibeInstruction}

Now write a reply to this message:
"${message.trim()}"

Reply only with the message. No explanations, no labels, no quotation marks. Just the reply itself.`;

  try {
    const reply = await callGroq(persona, userPrompt);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ Vibe Reply AI backend is running!" });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Vibe Reply AI backend running on port ${PORT}`);
});
