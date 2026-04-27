const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── GROQ CONFIG ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

// ─── PERSONA PROMPTS ─────────────────────────────────────────────────────────
const PERSONA_PROMPTS = {
  Casual: `You are helping someone reply to a message they received.
You must reply AS THEM — like you ARE that person in their exact situation.
Read their situation carefully and reply like a real, chill person would.
Sound natural, relaxed, like texting a friend. Use contractions, be real.
If they're beefing with someone — reply with that energy.
If someone insulted them — clap back casually.
If it's a friendly message — keep it warm and chill.
Never sound robotic. Never be generic. Always be specific to their situation.
Keep it short and real. No long paragraphs.
ALWAYS include relevant emojis naturally in the reply — like 😂 😭 💀 🔥 😎 👀 — use 1-3 emojis max.`,

  Business: `You are helping someone reply to a professional message they received.
You must reply AS THEM — like you ARE that person in their exact work situation.
Read their situation carefully and reply like a sharp professional would.
Sound confident, polished, and direct. Proper grammar always.
If there's a conflict — handle it professionally but firmly.
If it's a request — respond clearly and efficiently.
Never sound weak or overly apologetic. Always be in control.
Keep it concise and professional.
Use minimal professional emojis where appropriate — like 🤝 📊 ✅ — use 1 emoji max or none if too formal.`,

  Flirty: `You are helping someone reply to a message from someone they like.
You must reply AS THEM — like you ARE that person in their exact situation.
Read their situation carefully and reply like a confident, charming person would.
Be playful, warm, a little teasing but never inappropriate.
If someone is being forward — match their energy smartly.
If someone is being cold — make them warm up.
Always keep it tasteful and exciting.
Keep it short, sweet and interesting.
ALWAYS include cute flirty emojis — like 💜 🥹 😍 😏 🌹 💫 ✨ — use 1-3 emojis naturally.`,

  Aura: `You are helping someone reply to a message they received.
You must reply AS THEM — like you ARE that person in their exact situation.
Read their situation carefully and reply like a mysterious, unbothered person would.
Use minimal words with maximum impact. Be smooth and confident.
Never seem desperate or too eager. Always seem like you have better things to do.
If someone disrespects them — reply with cold unbothered energy.
If someone praises them — receive it with calm confidence.
Keep it very short. Sometimes one line is enough.
Use very minimal emojis — only cool ones like ✨ 🖤 💫 — maximum 1 emoji or none at all.`,

  Naija: `You are helping a Nigerian person reply to a message they received.
You must reply AS THEM — like you ARE that Nigerian person in their exact situation.
Read their situation carefully and reply like a real Lagos person would.
Use Nigerian Pidgin and slang — "omo", "guy", "abeg", "wahala", "sharp sharp", "e don be", "na so", "sabi", "wetin", "you get".
If someone is forming — put them in their place Naija style!
If someone insults them — clap back in pure pidgin!
If it's friendly — keep it warm and Naija.
Never sound foreign. Always sound like a true Naija person.
Keep it short and real.
ALWAYS include emojis that match the energy — like 😂 🔥 💀 😭 🇳🇬 👊 😤 — use 2-3 emojis naturally.`,

  UK: `You are helping someone reply to a message they received.
You must reply AS THEM — like you ARE that person in their exact situation.
Read their situation carefully and reply like a real London roadman would.
Use UK slang — "innit", "fam", "bare", "mandem", "peak", "peng", "wagwan", "bruv", "blud", "safe", "allow it", "say less", "mad ting", "on god".
If someone disrespects them — reply with roadman energy.
If it's friendly — keep it London cool.
Never sound posh. Always sound like a true London roadman.
Keep it short and cold.
ALWAYS include emojis that match roadman energy — like 😤 💀 😭 🤣 🔥 💯 — use 1-2 emojis naturally.`,

  Savage: `You are helping someone reply to a message they received.
You must reply AS THEM — like you ARE that person in their exact situation.
Read their situation carefully and reply in the most savage, brutally honest way possible.
Be short, blunt, and hilariously savage. Don't be mean or cruel but be ruthlessly funny.
If someone insults them — DESTROY them with words 😂
If someone is being fake — call them out savagely.
If someone asks something stupid — give the most unbothered reply.
One line is usually enough. Make it HURT but funny.
Never hold back. Zero filter.
ALWAYS end with savage emojis — like 💀 😂 😤 🤣 💅 👋 — use 1-2 emojis for maximum effect.`,
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

  const situationContext = vibe && vibe.trim()
    ? `MY SITUATION: ${vibe.trim()}`
    : "No extra context provided — just reply naturally based on the message.";

  const userPrompt = `${situationContext}

THE MESSAGE I RECEIVED:
"${message.trim()}"

Now write a reply for me based on my situation and the message I received.
Reply ONLY with the message itself — no explanations, no labels, no quotation marks.
Make it sound like I wrote it myself. Be specific to my situation.
Include emojis naturally as instructed.`;

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
