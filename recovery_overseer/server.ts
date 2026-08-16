import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/db/index.ts';
import { users, notebooks, savedQueries, driveImports } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { 
  handleMcpJsonRpc, 
  handleMcpSse, 
  MCP_SERVER_INFO, 
  MCP_TOOLS, 
  MCP_RESOURCES, 
  MCP_PROMPTS, 
  getWorkspaceAccountMapData,
  getMcpActiveClientsCount 
} from './src/server/mcpHandler.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // User synchronization endpoint
  app.post('/api/users/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      const displayName = req.user?.name || req.body.displayName || '';
      const photoUrl = req.user?.picture || req.body.photoUrl || '';

      if (!uid || !email) {
        return res.status(400).json({ error: 'Missing UID or email in token' });
      }

      const result = await db
        .insert(users)
        .values({
          uid,
          email,
          displayName,
          photoUrl,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            displayName,
            photoUrl,
          },
        })
        .returning();

      res.json(result[0]);
    } catch (err: any) {
      console.error('Error syncing user:', err);
      res.status(500).json({ error: 'Database user sync failed' });
    }
  });

  // Cloud SQL Saved Notebooks APIs
  app.get('/api/notebooks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const userNotebooks = await db
        .select()
        .from(notebooks)
        .where(eq(notebooks.userId, uid))
        .orderBy(desc(notebooks.updatedAt));

      res.json(userNotebooks);
    } catch (err: any) {
      console.error('Error fetching notebooks:', err);
      res.status(500).json({ error: 'Failed to fetch notebooks' });
    }
  });

  app.post('/api/notebooks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const { title, code, mode } = req.body;
      if (!uid || !title || !code) {
        return res.status(400).json({ error: 'Missing required notebook fields' });
      }

      const newNotebook = await db
        .insert(notebooks)
        .values({
          userId: uid,
          title,
          code,
          mode: mode || 'pyspark',
        })
        .returning();

      res.json(newNotebook[0]);
    } catch (err: any) {
      console.error('Error saving notebook:', err);
      res.status(500).json({ error: 'Failed to save notebook to Cloud SQL' });
    }
  });

  // Cloud SQL Saved Queries APIs
  app.get('/api/queries', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const queries = await db
        .select()
        .from(savedQueries)
        .where(eq(savedQueries.userId, uid))
        .orderBy(desc(savedQueries.createdAt));

      res.json(queries);
    } catch (err: any) {
      console.error('Error fetching queries:', err);
      res.status(500).json({ error: 'Failed to fetch saved queries' });
    }
  });

  // Spark Gemini AI Endpoints
  app.post('/api/spark/ai/optimize', async (req, res) => {
    try {
      const { code, mode } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
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

      res.json(parsed || { error: 'Could not parse JSON response.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gemini API call failed' });
    }
  });

  app.post('/api/spark/ai/generate', async (req, res) => {
    try {
      const { prompt, tableName } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
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

      res.json(parsed || { error: 'Could not parse JSON response.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gemini API call failed' });
    }
  });

  app.post('/api/spark/ai/explain', async (req, res) => {
    try {
      const { planText } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
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

      res.json({ explanation: response.text });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gemini API call failed' });
    }
  });

  app.post('/api/spark/ai/tts', async (req, res) => {
    try {
      const { text } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
      }
      if (!text) {
        return res.status(400).json({ error: 'Missing text for TTS.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audio: base64Audio });
      } else {
        res.status(500).json({ error: 'Failed to generate audio content.' });
      }
    } catch (err: any) {
      console.error('TTS generation error:', err);
      res.status(500).json({ error: err.message || 'Gemini TTS call failed' });
    }
  });

  // Model Context Protocol (MCP) Endpoints
  app.post('/api/mcp', async (req, res) => {
    await handleMcpJsonRpc(req, res);
  });

  app.get('/api/mcp/sse', (req, res) => {
    handleMcpSse(req, res);
  });

  app.get('/api/mcp/info', (req, res) => {
    res.json({
      server: MCP_SERVER_INFO,
      toolsCount: MCP_TOOLS.length,
      resourcesCount: MCP_RESOURCES.length,
      promptsCount: MCP_PROMPTS.length,
      activeSseClients: getMcpActiveClientsCount(),
      endpoint: '/api/mcp',
      sseEndpoint: '/api/mcp/sse',
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
    });
  });

  // Workspace Account Map Data Endpoint
  app.get('/api/workspace/account-map', (req, res) => {
    const category = req.query.category as string | undefined;
    const mapData = getWorkspaceAccountMapData(category);
    res.json(mapData);
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
