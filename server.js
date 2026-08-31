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
  
  const prompt = `你是一位專業的運動數據分析師，專精於${sportName}賽事預測。
請根據你對 ${home} 與 ${away} 的球隊實力、近期狀態、主客場優勢、傷兵情況、歷史對戰等綜合分析，給出本場比賽預測。

運動項目：${sportName}
主隊：${home}
客隊：${away}

請嚴格按照以下格式回答（繁體中文）：
🏠 主勝: XX%
${isSoccer ? '🤝 平局: XX%\n' : ''}✈️ 客勝: XX%
📊 信心度: X/10
💡 分析: （50-80字簡短分析，提到關鍵球員或戰術）

注意：
- 百分比加總${isSoccer ? '約等於100%' : '約等於100%（NBA/MLB無平局）'}
- 信心度 1-10，10為最有信心
- 分析要具體，提到球隊名稱與近期狀態`;

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
        temperature: 0.4,
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
