import express from 'express';
import 'dotenv/config';
import { loadFootballData, analyzeFootball, analyzeNBA, analyzeMLB, checkMatchExists, getTodaySchedule } from './data.js';

const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 啟動時自動載入足球數據
loadFootballData().catch(e => console.log('足球數據載入失敗:', e.message));

function parseInput(text) {
  const t = text.trim();
  const parts = t.split(/\s+/);

  if (parts.length >= 1) {
    const first = parts[0].toUpperCase();

    // 賽程查詢指令
    if (first === '今日赛程' || first === '今日賽程' || first === '今天赛程' || first === '今天賽程' || first === '今日比赛' || first === '今日比賽' || first === '今天比赛' || first === '今天比賽') {
      return { type: 'schedule', sport: parts[1] || 'all' };
    }

    // 預測指令：「預測 足球 阿森納 切爾西」或「足球 阿森納 切爾西」
    let startIdx = 0;
    if (first === '預測' || first === '预测') startIdx = 1;

    if (parts.length >= startIdx + 3) {
      const sportRaw = parts[startIdx].toUpperCase();
      const sportMap = {
        '足球': 'soccer', 'SOCCER': 'soccer', 'EPL': 'soccer', '英超': 'soccer',
        '西甲': 'soccer', '意甲': 'soccer', '德甲': 'soccer', '法甲': 'soccer',
        'NBA': 'nba', '籃球': 'nba', 'BASKETBALL': 'nba',
        'MLB': 'mlb', '棒球': 'mlb', 'BASEBALL': 'mlb'
      };
      const sport = sportMap[sportRaw];
      if (sport) {
        return { type: 'predict', sport, home: parts[startIdx + 1], away: parts[startIdx + 2] };
      }
    }
  }
  return null;
}

async function predictWithAI(sport, home, away) {
  const isSoccer = sport === 'soccer';
  const sportName = isSoccer ? '足球' : (sport === 'nba' ? 'NBA' : 'MLB');

  // 檢查比賽是否存在
  const matchCheck = await checkMatchExists(sport, home, away);
  if (!matchCheck.exists) {
    let warning = `⚠️ 近期賽程中未找到 ${home} vs ${away} 的比賽。`;
    if (matchCheck.date) {
      warning += `\n📅 最近一場是在 ${matchCheck.date}`;
    }
    if (matchCheck.similar && matchCheck.similar.length > 0) {
      warning += `\n\n💡 類似場次：\n${matchCheck.similar.map(m => `${m.HomeTeam || m.home} vs ${m.AwayTeam || m.away} ${m.Date || m.date || ''}`).join('\n')}`;
    }
    warning += `\n\n我還是可以根據歷史數據給出分析，但請確認比賽時間是否正確。`;
    return warning;
  }

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
${matchCheck.date ? `比賽日期：${matchCheck.date} ${matchCheck.time || ''}` : ''}

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
        const help = `👋 歡迎使用運動預測機器人 v2.0！

📅 【查賽程】
今日赛程  → 查看今天所有比賽
足球 今天  → 查看今天足球比賽
NBA 明天   → 查看明天NBA比賽

🔮 【做預測】
足球 Arsenal Chelsea
英超 阿森納 切爾西
NBA 湖人 塞爾提克
MLB 洋基 道奇

💡 提示：
• 英文隊名如有空格（如 Manchester City），請改用中文
• 預測前會先檢查近期是否有這場比賽
• 沒有比賽的話會提醒你，避免「幻覺」預測`;
        await replyToLINE(replyToken, help);
        continue;
      }

      // 賽程查詢
      if (parsed.type === 'schedule') {
        const schedule = await getTodaySchedule();
        if (schedule.length === 0) {
          await replyToLINE(replyToken, '📅 今天暫無比賽數據，或數據正在載入中。請稍後再試。');
        } else {
          const reply = `📅 今日比賽賽程：\n\n${schedule.join('\n')}`;
          await replyToLINE(replyToken, reply);
        }
        continue;
      }

      // 預測
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
    service: '運動預測 LINE Bot v2.0',
    features: ['賽程查詢', '比賽存在檢查', '真實數據預測'],
    supports: ['足球', 'NBA', 'MLB']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動在 http://localhost:${PORT}`);
  console.log(`📋 運動預測 Bot v2.0 - 足球 / NBA / MLB`);
});
