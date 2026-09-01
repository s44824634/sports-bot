import express from 'express';
import 'dotenv/config';
import { loadFootballData, analyzeFootball, analyzeNBA, analyzeMLB } from './data.js';

const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 啟動時自動載入足球數據
loadFootballData().catch(e => console.log('足球數據載入失敗:', e.message));

function parseInput(text) {
  const t = text.trim();
  const parts = t.split(/\s+/);

  if (parts.length >= 3) {
    const sportRaw = parts[0].toUpperCase();
    const sportMap = {
      '足球': 'soccer', 'SOCCER': 'soccer', 'EPL': 'soccer', '英超': 'soccer',
      '西甲': 'soccer', '意甲': 'soccer', '德甲': 'soccer', '法甲': 'soccer',
      'NBA': 'nba', '籃球': 'nba', 'BASKETBALL': 'nba',
      'MLB': 'mlb', '棒球': 'mlb', 'BASEBALL': 'mlb'
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

  // 嘗試獲取真實數據
  let dataContext = '';
  let hasRealData = false;

  try {
    if (isSoccer) {
      const stats = analyzeFootball(home, away);
      if (stats) {
        hasRealData = true;
        dataContext = stats.text;
      }
    } else if (sport === 'nba') {
      const stats = await analyzeNBA(home, away);
      if (stats) {
        hasRealData = true;
        dataContext = stats.text;
      }
    } else if (sport === 'mlb') {
      const stats = await analyzeMLB(home, away);
      if (stats) {
        hasRealData = true;
        dataContext = stats.text;
      }
    }
  } catch (e) {
    console.log('數據獲取失敗:', e.message);
  }

  const prompt = `你是一位專業運動數據分析師，專精${sportName}。

${hasRealData ? `以下為真實比賽數據，請**嚴格根據這些數據**分析，**絕對禁止編造球員名字**，只能引用數據中呈現的趨勢：
${dataContext}` : `注意：目前沒有該球隊的詳細實時數據庫紀錄，請只給出大方向趨勢分析，**絕對禁止编造具体球员名字**，只談球隊整體風格與實力對比。`}

比賽：${home} (主) vs ${away} (客)

請嚴格按以下格式回答（繁體中文）：
🏠 主勝: XX%
${isSoccer ? '🤝 平局: XX%\n' : ''}✈️ 客勝: XX%
📊 信心度: X/10
💡 分析: （50-80字，${hasRealData ? '基於上述真實數據' : '基於一般球隊實力與風格'}，**不提及具體球員名字**，只談數據趨勢與球隊風格）

規則：
- 百分比加總${isSoccer ? '約等於100%' : '約等於100%（NBA/MLB無平局）'}
- 信心度 1-10
- ${hasRealData ? '分析必須呼應真實數據中的勝負、進球、主客場表現' : '只給大方向判斷，不編造細節'}
- **絕對禁止编造球员名字或具体战术细节**`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API錯誤: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('預測失敗:', err);
    return `⚠️ 預測暫時無法使用，請稍後再試。\n錯誤: ${err.message}`;
  }
}

async function replyToLINE(replyToken, text) {
  if (!LINE_TOKEN) {
    console.error('缺少 LINE token');
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
    console.error('LINE 回覆失敗:', err);
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
        const help = `👋 歡迎使用運動預測機器人！

請依照以下格式輸入（用空格分隔）：
⚽ 足球 Arsenal Chelsea
⚽ 英超 阿森納 切爾西
🏀 NBA Lakers Celtics
🏀 籃球 湖人 塞爾提克
⚾ MLB Yankees Dodgers
⚾ 棒球 洋基 道奇

💡 提示：英文隊名如有空格（如 Manchester City），請改用中文或縮寫`;
        await replyToLINE(replyToken, help);
        continue;
      }

      const { sport, home, away } = parsed;
      console.log(`🔮 [${sport}] ${home} vs ${away}`);

      const prediction = await predictWithAI(sport, home, away);
      await replyToLINE(replyToken, prediction);
    }
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: '運行中', 
    service: '運動預測 LINE Bot',
    supports: ['足球', 'NBA', 'MLB']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動在 http://localhost:${PORT}`);
  console.log(`📋 支援運動: 足球 / NBA / MLB`);
});
