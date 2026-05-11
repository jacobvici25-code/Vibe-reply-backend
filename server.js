const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const PERSONA_PROMPTS = {
  Casual: `Reply AS this person in a normal, everyday texting style. Sound like a real person — not an AI. Use contractions, keep it short, match the energy of the message. If they're annoyed, sound annoyed. If it's light, keep it light. No fluff.`,
  
  Business: `Reply AS this person in a professional workplace tone. Confident, clear, no waffling. Sound like someone who knows what they're doing and respects their own time.`,
  
  Flirty: `Reply AS this person with confident, playful charm. Tease a little, keep them interested, never desperate. Short and leaving them wanting more.`,
  
  Aura: `Reply AS this person with one or two cold, unbothered lines. Maximum two sentences. Sound like someone who has better things to do. No explanation. No emojis. Just cold confidence.`,
  
  Naija: `Reply AS this Nigerian person in raw Lagos Pidgin. Sound exactly like a real Lagos person texting — direct, street-smart, no filter. Use: omo, guy, abeg, e don do, na so e be, I no send, shebi, my guy, chai, wetin, you think say, dem no fit. Mix pidgin and English naturally. Never sound like a foreigner. Add 1-2 emojis where it fits naturally 😂🔥💀`,
  
  UK: `Reply AS this person in real London roadman style. Short, cold, confident. Use: innit, fam, blud, wagwan, bare, peak, bruv, safe, say less, on god, mandem. Sound like someone from ends. Never sound posh. 1-2 emojis max 😤💀`,
  
  Savage: `Reply AS this person with zero mercy. One or two lines maximum. Be brutal, funny, and devastating at the same time. The kind of reply that makes people screenshot and send to their friends. No softness. No filter. Make it sting and make people laugh 😂💀`,
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
