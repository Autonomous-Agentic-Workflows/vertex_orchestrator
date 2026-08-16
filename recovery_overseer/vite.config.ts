import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

function sparkAiPlugin(): Plugin {
  return {
    name: 'spark-ai-plugin',
    configureServer(server) {
      server.middlewares.use('/api/spark/ai/optimize', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { code, mode } = JSON.parse(body || '{}');
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
              return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const prompt = `You are a Principal Apache Spark & PySpark Performance Tuning Architect.
Analyze the following Spark code (${mode || 'pyspark'}):
\`\`\`
${code}
\`\`\`

Return a valid JSON object with the following key structure:
{
  "originalCode": "string",
  "optimizedCode": "string with improved code using best practices like broadcast joins, AQE, filter pushdown",
  "summary": "1 sentence high level overview",
  "antiPatternsDetected": ["array of anti patterns found"],
  "performanceGainEstimate": "e.g. 3.2x Faster (70% lower shuffle bytes)",
  "suggestions": [
    {
      "category": "Memory" | "Shuffle" | "Partitioning" | "Join Optimization" | "Caching",
      "title": "string",
      "description": "string",
      "codeSnippet": "string optional"
    }
  ]
}
Return ONLY pure valid raw JSON.`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(parsed || { error: 'Could not parse JSON response.' }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Gemini API call failed' }));
          }
        });
      });

      server.middlewares.use('/api/spark/ai/generate', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { prompt, tableName } = JSON.parse(body || '{}');
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
              return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const aiPrompt = `Generate a clean, idiomatic PySpark DataFrame pipeline and equivalent Spark SQL query for:
User Prompt: "${prompt}"
Table Name: "${tableName}"

Return a valid JSON object with keys:
{
  "pysparkCode": "clean executable PySpark code",
  "sqlCode": "clean executable Spark SQL query",
  "explanation": "concise explanation of Spark transformations used"
}
Return ONLY pure valid raw JSON.`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: aiPrompt,
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(parsed || { error: 'Could not parse JSON response.' }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Gemini API call failed' }));
          }
        });
      });

      server.middlewares.use('/api/spark/ai/explain', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { planText } = JSON.parse(body || '{}');
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
              return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const aiPrompt = `Explain this Apache Spark Catalyst Physical Plan step by step in clear bullet points:
\`\`\`
${planText}
\`\`\`
Explain scans, predicate pushdowns, HashAggregates, and shuffle exchanges.`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: aiPrompt,
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ explanation: response.text }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Gemini API call failed' }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sparkAiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
