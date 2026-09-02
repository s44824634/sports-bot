import express from 'express';
import 'dotenv/config';
import { loadFootballData, analyzeFootball, analyzeNBA, analyzeMLB, checkMatchExists, getSchedule, getLiveScores, translateToEnglish } from './data.js';

const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 啟動時自動載入足球數據
loadFootballData().catch(e => console.log('足球數據載入失敗:', e.message));

// 清理訊息（去掉@機器人的部分，支援群組）
function cleanText(text) {
  return text.replace(/@\S+/g, '').trim();
}

function parseInput(text) {
  const t = cleanText(text);
  const parts = t.split(/\s+/);

  if (parts.length >= 1) {
    const first = parts[0].toUpperCase();

    // 賽程查詢指令
    const scheduleKeywords = ['今日賽程', '今天賽程', '今日比賽', '今天比賽'];
    const tomorrowKeywords = ['明日賽程', '明天賽程', '明日比賽', '明天比賽'];
    const scoreKeywords = ['比分', '即時比分', '目前比分', '現在比分', 'live', 'LIVE'];

    if (scheduleKeywords.includes(first) || scheduleKeywords.some(k => t.includes(k))) {
      const sport = parts[1] || 'all';
      return { type: 'schedule', sport, days: 0 };
    }

    if (tomorrowKeywords.includes(first) || tomorrowKeywords.some(k => t.includes(k))) {
      const sport = parts[1] || 'all';
      return { type: 'schedule', sport, days: 1 };
    }

    if (scoreKeywords.includes(first) || scoreKeywords.some(k => t.includes(k))) {
      const sport = parts[1] || 'all';
      return { type: 'live', sport };
    }

    // 預測指令
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

  // 把中文隊名轉回英文（數據查詢用英文）
  const homeEn = translateToEnglish(home);
  const awayEn = translateToEnglish(away);

  // 檢查比賽是否存在
  const matchCheck = await checkMatchExists(sport, homeEn, awayEn);
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
      const stats = analyzeFootball(homeEn, awayEn);
      if (stats) {
        hasRealData = true;
        dataContext = stats.text;
      }
    } else if (sport === 'nba') {
      const stats = await analyzeNBA(homeEn, awayEn);
      if (stats) {
        hasRealData = true;
        dataContext = stats.text;
      }
    } else if (sport === 'mlb') {
      const stats = await analyzeMLB(homeEn, awayEn);
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

請嚴格按以下格式回答（**100% 繁體中文**，禁止任何簡體字）：
🏠 主勝: XX%
${isSoccer ? '🤝 平局: XX%\n' : ''}✈️ 客勝: XX%
📊 信心度: X/10
💡 分析: （50-80字，${hasRealData ? '基於上述真實數據' : '基於一般球隊實力與風格'}，**不提及具體球員名字**，只談數據趨勢與球隊風格）

規則：
- 百分比加總${isSoccer ? '約等於100%' : '約等於100%（NBA/MLB無平局）'}
- 信心度 1-10
- ${hasRealData ? '分析必須呼應真實數據中的勝負、進球、主客場表現' : '只給大方向判斷，不編造細節'}
- **絕對禁止编造球员名字或具体战术细节**
- **所有文字必須是繁體中文，禁止出現簡體字（如：胜→勝、队→隊、龙→龍、鸟→鳥、马→馬、鱼→魚）**
- **如果無法確定繁體寫法，請改用同義詞或省略該字**`;

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
        const help = `👋 歡迎使用運動預測機器人 v3.0！

📅 【查賽程】
今日賽程    → 查看今天所有比賽
明日賽程    → 查看明天所有比賽
足球 明天   → 查看明天足球比賽

📊 【看比分】
比分        → 查看所有進行中比賽
比分 NBA    → 查看NBA進行中比賽
比分 MLB    → 查看MLB進行中比賽

🔮 【做預測】
足球 Arsenal Chelsea
英超 阿森納 切爾西
NBA 湖人 塞爾提克
MLB 洋基 道奇

💡 提示：
• 群組中也可以@我使用所有功能
• 英文隊名如有空格，請改用中文
• 預測前會先檢查近期是否有這場比賽`;
        await replyToLINE(replyToken, help);
        continue;
      }

      // 賽程查詢
      if (parsed.type === 'schedule') {
        const label = parsed.days === 0 ? '今日' : '明日';
        const schedule = await getSchedule(parsed.days);

        // 過濾特定運動
        let filtered = schedule;
        if (parsed.sport !== 'all') {
          const sportMap = { '足球': '⚽', 'soccer': '⚽', 'NBA': '🏀', 'nba': '🏀', 'MLB': '⚾', 'mlb': '⚾', '籃球': '🏀', '棒球': '⚾' };
          const emoji = sportMap[parsed.sport];
          if (emoji) {
            filtered = schedule.filter(s => s.startsWith(emoji));
          }
        }

        if (filtered.length === 0) {
          await replyToLINE(replyToken, `📅 ${label}暫無比賽數據，或數據正在載入中。請稍後再試。`);
        } else {
          const reply = `📅 ${label}比賽賽程：\n\n${filtered.join('\n')}`;
          await replyToLINE(replyToken, reply);
        }
        continue;
      }

      // 即時比分
      if (parsed.type === 'live') {
        const scores = await getLiveScores(parsed.sport);

        if (scores.length === 0) {
          await replyToLINE(replyToken, '📊 目前暫無進行中的比賽。');
        } else {
          const reply = `📊 進行中比賽比分：\n\n${scores.join('\n\n')}`;
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
    service: '運動預測 LINE Bot v3.0',
    features: ['賽程查詢', '明日賽程', '即時比分', '比賽存在檢查', '真實數據預測', '群組支援'],
    supports: ['足球', 'NBA', 'MLB']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動在 http://localhost:${PORT}`);
  console.log(`📋 運動預測 Bot v3.0 - 足球 / NBA / MLB`);
});
