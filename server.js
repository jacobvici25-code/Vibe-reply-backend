const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const PERSONA_PROMPTS = {
  Casual: `You are helping someone reply to a message they received. Reply AS THEM in a chill, relaxed, natural way like texting a close friend. Sound real, not robotic.`,
  Business: `You are helping someone reply to a professional message. Reply AS THEM in a sharp, confident, professional tone. Proper grammar, concise and direct.`,
  Flirty: `You are helping someone reply to a message from someone they like. Reply AS THEM in a playful, warm, charming way. Tasteful and exciting.`,
  Aura: `You are helping someone reply to a message. Reply AS THEM with mysterious, calm, unbothered energy. Minimal words, maximum impact.`,
  Naija: `You are helping a Nigerian person reply to a message. Reply AS THEM in pure Lagos Pidgin English. Sound like a real Lagosian — direct, street-smart, warm. Use real slang: omo, guy, abeg, wahala, e don do, na so e be, shey you get, I no send, make e no vex, chai, shebi, my guy, na lie, e pain me, shey you dey mad. Mix English and Pidgin naturally. Never sound foreign.`,
  UK: `You are helping someone reply to a message. Reply AS THEM in real London roadman slang. Use: innit, fam, bare, mandem, peak, peng, wagwan, bruv, blud, safe, allow it, say less, on god. Sound like a true London roadman.`,
  Savage: `You are helping someone reply to a message. Reply AS THEM in the most savage, brutally honest, funny way possible. Short, blunt, zero filter. Make it hurt but funny.`,
};

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
      max_tokens: 500,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "";
}

app.post("/api/chat", async (req, res) => {
  const { message, vibe, style } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  if (isRubbish(message)) {
    return res.status(200).json({
      reply: "⚠️ That looks like a typo or random text. Please paste a real message!",
      coaching: null,
    });
  }

  const persona = PERSONA_PROMPTS[style] || PERSONA_PROMPTS["Casual"];
  const situationContext = vibe && vibe.trim()
    ? `MY SITUATION: ${vibe.trim()}`
    : "No extra context provided.";

  const userPrompt = `${situationContext}

THE MESSAGE I RECEIVED:
"${message.trim()}"

Respond with ONLY a valid JSON object in this exact format, nothing else:
{
  "reply": "your reply here",
  "coaching": {
    "headline": "one short sentence explaining why this reply works",
    "emotional_effect": "how this reply makes the other person feel",
    "strategy": "the communication strategy being used",
    "confidence_tip": "one tip to sound even more confident"
  }
}`;

  try {
    const raw = await callGroq(persona, userPrompt);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json({
      reply: parsed.reply || "",
      coaching: parsed.coaching || null,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "✅ Vibe Reply AI backend is running!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Vibe Reply AI backend running on port ${PORT}`);
});
