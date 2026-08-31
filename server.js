import express from 'express';
import 'dotenv/config';

const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function parseInput(text) {
  const t = text.trim();
  const parts = t.split(/\s+/);
  
  if (parts.length >= 3) {
    const sportRaw = parts[0].toUpperCase();
    const sportMap = {
      'SOCCER': 'soccer', 'EPL': 'soccer', 'FOOTBALL': 'soccer',
      'NBA': 'nba', 'BASKETBALL': 'nba',
      'MLB': 'mlb', 'BASEBALL': 'mlb'
    };
    const sport = sportMap[sportRaw];
    if (sport) {
      return { sport, home: parts[1], away: parts[2] };
    }
  }
  return null;
}

async function predictWithAI(sport, home, away) {
  const isSoccer = sport === 'soccer';
  const sportName = isSoccer ? '足球' : (sport === 'nba' ? 'NBA' : 'MLB');
  
  const prompt = `You are a professional sports analyst specializing in ${sportName}.
Analyze the upcoming match between ${home} (home) and ${away} (away).
Consider: team strength, recent form, home/away advantage, injuries, head-to-head history.

Sport: ${sportName}
Home: ${home}
Away: ${away}

Reply in Traditional Chinese (繁體中文) using EXACTLY this format:
主勝: XX%
${isSoccer ? '平局: XX%\n' : ''}客勝: XX%
信心度: X/10
分析: (50-80 words, mention key players and tactics)

Rules:
- Percentages sum to ~100%
- Confidence 1-10, 10 is most confident
- Be specific about team names and recent status`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('Prediction failed:', err);
    return `Prediction temporarily unavailable.\nError: ${err.message}`;
  }
}

async function replyToLINE(replyToken, text) {
  if (!LINE_TOKEN) {
    console.error('Missing LINE token');
    return;
  }
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    });
  } catch (err) {
    console.error('LINE reply failed:', err);
  }
}

app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const replyToken = event.replyToken;

      const parsed = parseInput(text);

      if (!parsed) {
        const help = `Welcome to Sports Prediction Bot!

Format: SPORT HomeTeam AwayTeam
Examples:
SOCCER Arsenal Chelsea
NBA Lakers Celtics
MLB Yankees Dodgers

Note: Use English team names (no spaces).`;
        await replyToLINE(replyToken, help);
        continue;
      }

      const { sport, home, away } = parsed;
      console.log(`[${sport}] ${home} vs ${away}`);

      const prediction = await predictWithAI(sport, home, away);
      await replyToLINE(replyToken, prediction);
    }
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    service: 'Sports Prediction LINE Bot',
    supports: ['SOCCER', 'NBA', 'MLB']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Supports: SOCCER / NBA / MLB`);
});