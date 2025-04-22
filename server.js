require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const generatePDF = require("./generatePDF");

const app = express();
const PORT = process.env.PORT || 3000;

const fs = require("fs");
const usageFile = path.join(__dirname, "usage.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Utility to replace {{variables}} in the prompt
function fillTemplate(template, variables) {
  return template.replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] || "");
}

function updateUsage(tokens) {
  let data = { total_tokens: 0 };
  if (fs.existsSync(usageFile)) {
    data = JSON.parse(fs.readFileSync(usageFile));
  }
  data.total_tokens += tokens;
  fs.writeFileSync(usageFile, JSON.stringify(data));
  return data.total_tokens;
}

// Get available prompts
app.get("/api/prompts", (req, res) => {
  const list = Object.entries(prompts).map(([key, { name, variables }]) => ({
    key,
    name,
    variables,
  }));
  res.json(list);
});

// Generate content from prompt using OpenAI
app.post("/api/generate", async (req, res) => {
  const { key, values, prompt: customPrompt } = req.body;
  let prompt = "";
  if (customPrompt && customPrompt.trim() !== "") {
    prompt = customPrompt;
  } else {
    const promptConfig = prompts[key];
    if (!promptConfig) return res.status(404).send("Prompt not found");
    prompt = fillTemplate(promptConfig.template, values);
  }

  console.log("Prompt envoyé à OpenAI:", prompt);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || '';
    console.log("Réponse reçue d'OpenAI:", content);
    if (!content || content.trim() === "") {
      return res.status(500).send("Réponse vide reçue d'OpenAI");
    }

    const tokensUsed = response.data.usage?.total_tokens || 0;
    const costUSD = (tokensUsed / 1000 * 0.001).toFixed(4);
    const totalTokens = updateUsage(tokensUsed);
    const totalCost = (totalTokens / 1000 * 0.001).toFixed(4);
    res.json({ result: content, tokensUsed, costUSD, totalTokens, totalCost });
  } catch (err) {
    console.error("Erreur OpenAI :", err.response?.data, err.message);
    res.status(500).send("Erreur lors de l'appel à OpenAI");
  }
});

// ✅ Génération du PDF
app.post("/api/pdf", async (req, res) => {
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).send("Contenu vide, impossible de générer un PDF.");
  }

  try {
    const pdfBuffer = await generatePDF(content);
    console.log("PDF Buffer Length:", pdfBuffer.length);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="livre.pdf"');
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("Erreur PDF :", err);
    res.status(500).send("Erreur lors de la génération du PDF");
  }
});

app.get("/api/usage", (req, res) => {
  if (fs.existsSync(usageFile)) {
    const data = JSON.parse(fs.readFileSync(usageFile));
    const cost = (data.total_tokens / 1000 * 0.001).toFixed(4); // 0.001 $ / 1K tokens pour gpt-3.5-turbo
    res.json({ totalTokens: data.total_tokens, totalCost: cost });
  } else {
    res.json({ totalTokens: 0, totalCost: "0.0000" });
  }
});

app.get('/api/check-key', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("API Key actuelle :", process.env.OPENAI_API_KEY);
  if (apiKey && apiKey !== '') {
    res.status(200).json({ success: true });
  } else {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  console.log(`Cle api bien charger ${process.env.OPENAI_API_KEY}`);
});