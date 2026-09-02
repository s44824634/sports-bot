// ========== 球隊名稱翻譯對照表 ==========
const TEAM_NAME_ZH = {
  // MLB
  'Pittsburgh Pirates': '匹茲堡海盜', 'San Francisco Giants': '舊金山巨人',
  'Cleveland Guardians': '克里夫蘭守護者', 'Toronto Blue Jays': '多倫多藍鳥',
  'Houston Astros': '休士頓太空人', 'Chicago White Sox': '芝加哥白襪',
  'Baltimore Orioles': '巴爾的摩金鶯', 'Boston Red Sox': '波士頓紅襪',
  'Chicago Cubs': '芝加哥小熊', 'Milwaukee Brewers': '密爾瓦基釀酒人',
  'Kansas City Royals': '堪薩斯市皇家', 'Miami Marlins': '邁阿密馬林魚',
  'Texas Rangers': '德州遊騎兵', 'Tampa Bay Rays': '坦帕灣光芒',
  'Seattle Mariners': '西雅圖水手', 'Athletics': '奧克蘭運動家',
  'Los Angeles Dodgers': '洛杉磯道奇', 'St. Louis Cardinals': '聖路易紅雀',
  'New York Yankees': '紐約洋基', 'New York Mets': '紐約大都會',
  'Philadelphia Phillies': '費城費城人', 'Atlanta Braves': '亞特蘭大勇士',
  'Cincinnati Reds': '辛辛那提紅人', 'San Diego Padres': '聖地牙哥教士',
  'Arizona Diamondbacks': '亞利桑那響尾蛇', 'Colorado Rockies': '科羅拉多洛磯',
  'Los Angeles Angels': '洛杉磯天使', 'Detroit Tigers': '底特律老虎',
  'Minnesota Twins': '明尼蘇達雙城', 'Washington Nationals': '華盛頓國民',
  // NBA
  'Los Angeles Lakers': '洛杉磯湖人', 'Boston Celtics': '波士頓塞爾提克',
  'Golden State Warriors': '金州勇士', 'Chicago Bulls': '芝加哥公牛',
  'Miami Heat': '邁阿密熱火', 'New York Knicks': '紐約尼克',
  'Brooklyn Nets': '布魯克林籃網', 'Dallas Mavericks': '達拉斯獨行俠',
  'Phoenix Suns': '鳳凰城太陽', 'Milwaukee Bucks': '密爾瓦基公鹿',
  'Philadelphia 76ers': '費城七六人', 'Denver Nuggets': '丹佛金塊',
  'LA Clippers': '洛杉磯快艇', 'Toronto Raptors': '多倫多暴龍',
  'Houston Rockets': '休士頓火箭', 'San Antonio Spurs': '聖安東尼奧馬刺',
  'Oklahoma City Thunder': '奧克拉荷馬雷霆', 'Utah Jazz': '猶他爵士',
  'Portland Trail Blazers': '波特蘭拓荒者', 'Sacramento Kings': '沙加緬度國王',
  'Indiana Pacers': '印第安納溜馬', 'Detroit Pistons': '底特律活塞',
  'Cleveland Cavaliers': '克里夫蘭騎士', 'Atlanta Hawks': '亞特蘭大老鷹',
  'Charlotte Hornets': '夏洛特黃蜂', 'Washington Wizards': '華盛頓巫師',
  'Orlando Magic': '奧蘭多魔術', 'Minnesota Timberwolves': '明尼蘇達灰狼',
  'Memphis Grizzlies': '曼菲斯灰熊', 'New Orleans Pelicans': '紐奧良鵜鶘',
};

function translateTeamName(name) {
  if (!name) return name;
  // 先嘗試完全匹配
  if (TEAM_NAME_ZH[name]) return TEAM_NAME_ZH[name];
  // 嘗試部分匹配（去除城市名）
  for (const [en, zh] of Object.entries(TEAM_NAME_ZH)) {
    if (name.includes(en.split(' ').pop()) || en.includes(name)) {
      return zh;
    }
  }
  return name;
}

// 反向翻譯：中文 → 英文（用於查詢數據）
const TEAM_NAME_EN = {};
for (const [en, zh] of Object.entries(TEAM_NAME_ZH)) {
  TEAM_NAME_EN[zh] = en;
  // 也加入簡體映射
  const zhSimple = zh.replace(/國/g, '国').replace(/馬/g, '马').replace(/魚/g, '鱼').replace(/鳥/g, '鸟').replace(/龍/g, '龙').replace(/隊/g, '队').replace(/勝/g, '胜')..replace(/負/g, '负');
  TEAM_NAME_EN[zhSimple] = en;
}

export function translateToEnglish(name) {
  if (!name) return name;
  // 1. 直接匹配
  if (TEAM_NAME_EN[name]) return TEAM_NAME_EN[name];

  // 2. 模糊匹配：只要輸入的隊名「對到兩個字以上」就自動配對
  let bestMatch = null;
  let bestScore = 0;

  for (const [zh, en] of Object.entries(TEAM_NAME_EN)) {
    // 計算共同子串長度（簡化版：檢查是否互相包含）
    if (zh.includes(name)) {
      // 用戶輸入被完整包含在對照表中（如「海盜」在「匹茲堡海盜」中）
      const score = name.length;
      if (score >= 2 && score > bestScore) {
        bestScore = score;
        bestMatch = en;
      }
    } else if (name.includes(zh)) {
      // 對照表被完整包含在用戶輸入中（如「洛杉磯湖人」包含「湖人」）
      const score = zh.length;
      if (score >= 2 && score > bestScore) {
        bestScore = score;
        bestMatch = en;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // 3. 嘗試逐字匹配（至少兩個字相同）
  for (const [zh, en] of Object.entries(TEAM_NAME_EN)) {
    let matchCount = 0;
    for (let i = 0; i < name.length - 1; i++) {
      const twoChars = name.substring(i, i + 2);
      if (zh.includes(twoChars)) {
        matchCount = Math.max(matchCount, 2);
        break;
      }
    }
    if (matchCount >= 2) {
      return en;
    }
  }

  return name; // 找不到就回傳原樣
}


import { readFileSync } from 'fs';

// ========== 足球 CSV 自動下載與解析 ==========
let footballData = null;

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let inQuotes = false;
    let current = '';
    for (const char of line) {
      if (char === '"' && !inQuotes) inQuotes = true;
      else if (char === '"' && inQuotes) inQuotes = false;
      else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else current += char;
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

async function fetchFootballCsv(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseCsv(await res.text());
  } catch (e) {
    return null;
  }
}

export async function loadFootballData() {
  if (footballData) return footballData;
  const leagues = [
    { url: 'https://www.football-data.co.uk/mmz4281/2425/E0.csv', name: '英超' },
    { url: 'https://www.football-data.co.uk/mmz4281/2425/SP1.csv', name: '西甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2425/I1.csv', name: '意甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2425/D1.csv', name: '德甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2425/F1.csv', name: '法甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2526/E0.csv', name: '英超' },
    { url: 'https://www.football-data.co.uk/mmz4281/2526/SP1.csv', name: '西甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2526/I1.csv', name: '意甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2526/D1.csv', name: '德甲' },
    { url: 'https://www.football-data.co.uk/mmz4281/2526/F1.csv', name: '法甲' },
  ];

  footballData = [];
  for (const league of leagues) {
    const matches = await fetchFootballCsv(league.url);
    if (matches) {
      matches.forEach(m => m._league = league.name);
      footballData.push(...matches);
    }
  }
  console.log(`足球數據載入完成: ${footballData.length} 場比賽`);
  return footballData;
}

function getTeamStats(matches, teamName, isHome, lastN) {
  let filtered = matches.filter(m => m.HomeTeam === teamName || m.AwayTeam === teamName);
  if (isHome !== null) {
    filtered = filtered.filter(m => isHome ? m.HomeTeam === teamName : m.AwayTeam === teamName);
  }
  filtered.sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));
  filtered = filtered.slice(0, lastN);

  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  for (const m of filtered) {
    const isH = m.HomeTeam === teamName;
    const goalsFor = parseInt(isH ? m.FTHG : m.FTAG) || 0;
    const goalsAgainst = parseInt(isH ? m.FTAG : m.FTHG) || 0;
    gf += goalsFor; ga += goalsAgainst;
    if (goalsFor > goalsAgainst) wins++;
    else if (goalsFor === goalsAgainst) draws++;
    else losses++;
  }
  return { wins, draws, losses, gf, ga, played: filtered.length };
}

function getHeadToHead(matches, home, away, lastN) {
  const h2h = matches.filter(m => 
    (m.HomeTeam === home && m.AwayTeam === away) ||
    (m.HomeTeam === away && m.AwayTeam === home)
  );
  h2h.sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));
  return h2h.slice(0, lastN).map(m => ({
    date: m.Date,
    home: m.HomeTeam,
    away: m.AwayTeam,
    score: `${m.FTHG}-${m.FTAG}`
  }));
}

export function analyzeFootball(home, away) {
  if (!footballData || footballData.length === 0) return null;
  const homeAll = getTeamStats(footballData, home, null, 5);
  const awayAll = getTeamStats(footballData, away, null, 5);
  const homeHome = getTeamStats(footballData, home, true, 5);
  const awayAway = getTeamStats(footballData, away, false, 5);
  const h2h = getHeadToHead(footballData, home, away, 3);

  if (homeAll.played === 0 && awayAll.played === 0) return null;

  return {
    homeAll, awayAll, homeHome, awayAway, h2h,
    text: `【真實數據】
${home} 近5場: ${homeAll.wins}勝 ${homeAll.draws}平 ${homeAll.losses}負, 進${homeAll.gf}失${homeAll.ga}
${home} 主場近5場: ${homeHome.wins}勝 ${homeHome.draws}平 ${homeHome.losses}負, 進${homeHome.gf}失${homeHome.ga}
${away} 近5場: ${awayAll.wins}勝 ${awayAll.draws}平 ${awayAll.losses}負, 進${awayAll.gf}失${awayAll.ga}
${away} 客場近5場: ${awayAway.wins}勝 ${awayAway.draws}平 ${awayAway.losses}負, 進${awayAway.gf}失${awayAway.ga}
歷史對戰: ${h2h.length > 0 ? h2h.map(h => `${h.home} ${h.score} ${h.away}`).join('; ') : '無紀錄'}`
  };
}

// ========== 赛程查询 ==========
function formatDateStr(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(2);
  const yyyy = date.getFullYear();
  const mm2 = String(date.getMonth() + 1).padStart(2, '0');
  const dd2 = String(date.getDate()).padStart(2, '0');
  return {
    slash: `${dd}/${mm}/${yy}`,
    iso: `${yyyy}-${mm2}-${dd2}`
  };
}

export async function getSchedule(daysOffset) {
  const target = new Date();
  target.setDate(target.getDate() + daysOffset);
  const ds = formatDateStr(target);
  const results = [];

  // 足球
  if (footballData) {
    const soccer = footballData.filter(m => m.Date === ds.slash || m.Date === ds.iso).map(m => 
      `⚽ ${m._league}: ${m.HomeTeam} vs ${m.AwayTeam} ${m.Time || ''}`
    );
    results.push(...soccer);
  }

  // NBA/MLB 從ESPN scoreboard獲取
  const nbaEvents = await fetchEspnScoreboard('basketball/nba', target);
  nbaEvents.forEach(e => results.push(`🏀 NBA: ${e.home} vs ${e.away} ${e.time || ''}`));

  const mlbEvents = await fetchEspnScoreboard('baseball/mlb', target);
  mlbEvents.forEach(e => results.push(`⚾ MLB: ${e.home} vs ${e.away} ${e.time || ''}`));

  return results;
}

async function fetchEspnScoreboard(sport, date) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard?dates=${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map(e => {
      const comp = e.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      return {
        home: translateTeamName(home?.team?.displayName || home?.team?.name),
        away: translateTeamName(away?.team?.displayName || away?.team?.name),
        time: e.status?.type?.shortDetail || '',
      };
    });
  } catch (e) {
    return [];
  }
}

// ========== 即時比分 ==========
export async function getLiveScores(sport) {
  const results = [];

  if (sport === 'soccer' || sport === 'all') {
    const soccerScores = await fetchEspnLiveScores([
      'soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1'
    ]);
    results.push(...soccerScores.map(s => 
      `⚽ ${s.league} | ${s.home} ${s.homeScore} - ${s.awayScore} ${s.away} | ${s.status} ${s.clock}`
    ));
  }

  if (sport === 'nba' || sport === 'all') {
    const nbaScores = await fetchEspnLiveScores(['basketball/nba']);
    results.push(...nbaScores.map(s => 
      `🏀 NBA | ${s.home} ${s.homeScore} - ${s.awayScore} ${s.away} | ${s.status} ${s.clock}`
    ));
  }

  if (sport === 'mlb' || sport === 'all') {
    const mlbScores = await fetchEspnLiveScores(['baseball/mlb']);
    results.push(...mlbScores.map(s => 
      `⚾ MLB | ${s.home} ${s.homeScore} - ${s.awayScore} ${s.away} | ${s.status} ${s.clock}`
    ));
  }

  return results;
}

async function fetchEspnLiveScores(sports) {
  const all = [];
  for (const sport of sports) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const events = (data.events || []).filter(e => {
        const s = e.competitions?.[0]?.status;
        return s && (s.type?.state === 'in' || s.type?.name?.includes('IN_PROGRESS'));
      });

      for (const e of events) {
        const comp = e.competitions[0];
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        const status = comp.status;

        let clock = status.displayClock || '';
        let period = '';
        if (sport.includes('basketball')) {
          period = `第${status.period}節`;
        } else if (sport.includes('baseball')) {
          period = `第${status.period}局`;
        } else if (sport.includes('soccer')) {
          period = status.period === 1 ? '上半場' : (status.period === 2 ? '下半場' : '');
          if (clock) clock = `${clock}分鐘`;
        }

        all.push({
          league: data.leagues?.[0]?.name || sport,
          home: translateTeamName(home?.team?.displayName || home?.team?.name),
          away: translateTeamName(away?.team?.displayName || away?.team?.name),
          homeScore: home?.score?.value || '0',
          awayScore: away?.score?.value || '0',
          status: period,
          clock: clock,
        });
      }
    } catch (e) {
      console.log(`ESPN ${sport} 比分獲取失敗:`, e.message);
    }
  }
  return all;
}

// ========== NBA / MLB 歷史數據 ==========
const NBA_TEAM_IDS = {
  'lakers': 13, '湖人': 13,
  'celtics': 2, '塞爾提克': 2, '凯尔特人': 2,
  'warriors': 9, '勇士': 9,
  'bulls': 4, '公牛': 4,
  'heat': 14, '熱火': 14, '热火': 14,
  'knicks': 18, '尼克': 18, '尼克斯': 18,
  'nets': 17, '籃網': 17, '篮网': 17,
  'mavericks': 6, '獨行俠': 6, '独行侠': 6,
  'suns': 21, '太陽': 21, '太阳': 21,
  'bucks': 15, '公鹿': 15, '雄鹿': 15,
  '76ers': 20, '七六人': 20, '76人': 20,
  'nuggets': 7, '金塊': 7, '掘金': 7,
  'clippers': 12, '快艇': 12, '快船': 12,
  'raptors': 28, '暴龍': 28, '猛龙': 28,
  'rockets': 10, '火箭': 10,
  'spurs': 24, '馬刺': 24, '马刺': 24,
  'thunder': 25, '雷霆': 25,
  'jazz': 26, '爵士': 26,
  'blazers': 22, '拓荒者': 22, '开拓者': 22,
  'kings': 23, '國王': 23, '国王': 23,
  'pacers': 11, '溜馬': 11, '步行者': 11,
  'pistons': 8, '活塞': 8,
  'cavaliers': 5, '騎士': 5, '骑士': 5,
  'hawks': 1, '老鷹': 1, '老鹰': 1,
  'hornets': 30, '黃蜂': 30, '黄蜂': 30,
  'wizards': 27, '巫師': 27, '奇才': 27,
  'magic': 19, '魔術': 19, '魔术': 19,
  'timberwolves': 16, '灰狼': 16, '森林狼': 16,
  'grizzlies': 29, '灰熊': 29,
  'pelicans': 3, '鵜鶘': 3, '鹈鹕': 3,
};

const MLB_TEAM_IDS = {
  'yankees': 10, '洋基': 10,
  'dodgers': 19, '道奇': 19,
  'red sox': 2, '紅襪': 2, '红袜': 2,
  'cubs': 16, '小熊': 16,
  'cardinals': 24, '紅雀': 24, '红雀': 24,
  'giants': 26, '巨人': 26,
  'mets': 21, '大都會': 21, '大都会': 21,
  'astros': 18, '太空人': 18,
  'braves': 1, '勇士': 1,
  'phillies': 22, '費城人': 22, '费城人': 22,
  'blue jays': 14, '藍鳥': 14, '蓝鸟': 14,
  'white sox': 4, '白襪': 4, '白袜': 4,
  'angels': 3, '天使': 3,
  'padres': 25, '教士': 25,
  'rangers': 13, '遊騎兵': 13, '游骑兵': 13,
  'mariners': 12, '水手': 12,
  'twins': 9, '雙城': 9, '双城': 9,
  'brewers': 8, '釀酒人': 8, '酿酒人': 8,
  'rockies': 27, '洛磯': 27, '洛基': 27,
  'diamondbacks': 29, '響尾蛇': 29, '响尾蛇': 29,
  'rays': 30, '光芒': 30,
  'pirates': 23, '海盜': 23, '海盗': 23,
  'reds': 17, '紅人': 17, '红人': 17,
  'orioles': 1, '金鶯': 1, '金莺': 1,
  'guardians': 5, '守護者': 5, '守护者': 5,
  'tigers': 6, '老虎': 6,
  'royals': 7, '皇家': 7,
  'nationals': 20, '國民': 20, '国民': 20,
  'marlins': 28, '馬林魚': 28, '马林鱼': 28,
  'athletics': 11, '運動家': 11, '运动家': 11,
};

async function fetchEspnSchedule(sport, teamId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/teams/${teamId}/schedule?season=2026`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const events = (data.events || []).filter(e => {
      const status = e.competitions?.[0]?.status?.type;
      return status && (status.completed || status.state === 'post');
    }).slice(-5);

    return events.map(e => {
      const comp = e.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      return {
        date: e.date,
        home: home?.team?.displayName || home?.team?.name,
        away: away?.team?.displayName || away?.team?.name,
        homeScore: home?.score?.value ?? '-',
        awayScore: away?.score?.value ?? '-',
        result: home?.winner === true ? 'W' : (home?.winner === false ? 'L' : 'D'),
      };
    });
  } catch (e) {
    return null;
  }
}

function getTeamRecord(events, teamName) {
  let wins = 0, losses = 0;
  for (const e of events) {
    if (e.result === 'W') wins++;
    else if (e.result === 'L') losses++;
  }
  return { wins, losses, played: events.length, games: events };
}

export async function analyzeNBA(home, away) {
  const homeId = NBA_TEAM_IDS[home.toLowerCase()];
  const awayId = NBA_TEAM_IDS[away.toLowerCase()];
  if (!homeId || !awayId) return null;

  const [homeEvents, awayEvents] = await Promise.all([
    fetchEspnSchedule('basketball/nba', homeId),
    fetchEspnSchedule('basketball/nba', awayId),
  ]);

  if (!homeEvents || !awayEvents) return null;

  const homeRec = getTeamRecord(homeEvents, home);
  const awayRec = getTeamRecord(awayEvents, away);

  return {
    text: `【NBA 真實數據】
${home} 近5場: ${homeRec.wins}勝 ${homeRec.losses}負
${away} 近5場: ${awayRec.wins}勝 ${awayRec.losses}負
${home} 最近: ${homeEvents.map(e => `vs ${e.away} ${e.homeScore}-${e.awayScore}`).join(', ')}
${away} 最近: ${awayEvents.map(e => `vs ${e.home} ${e.homeScore}-${e.awayScore}`).join(', ')}`
  };
}

export async function analyzeMLB(home, away) {
  const homeId = MLB_TEAM_IDS[home.toLowerCase()];
  const awayId = MLB_TEAM_IDS[away.toLowerCase()];
  if (!homeId || !awayId) return null;

  const [homeEvents, awayEvents] = await Promise.all([
    fetchEspnSchedule('baseball/mlb', homeId),
    fetchEspnSchedule('baseball/mlb', awayId),
  ]);

  if (!homeEvents || !awayEvents) return null;

  const homeRec = getTeamRecord(homeEvents, home);
  const awayRec = getTeamRecord(awayEvents, away);

  return {
    text: `【MLB 真實數據】
${home} 近5場: ${homeRec.wins}勝 ${homeRec.losses}負
${away} 近5場: ${awayRec.wins}勝 ${awayRec.losses}負
${home} 最近: ${homeEvents.map(e => `vs ${e.away} ${e.homeScore}-${e.awayScore}`).join(', ')}
${away} 最近: ${awayEvents.map(e => `vs ${e.home} ${e.homeScore}-${e.awayScore}`).join(', ')}`
  };
}

// 檢查近期是否有這場比賽
export async function checkMatchExists(sport, home, away) {
  if (sport === 'soccer') {
    if (!footballData) await loadFootballData();
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 7);

    const upcoming = footballData.filter(m => {
      const d = m.Date;
      if (!d) return false;
      const parts = d.split('/');
      let matchDate;
      if (parts.length === 3) {
        const [dd, mm, yy] = parts;
        matchDate = new Date(`20${yy}-${mm}-${dd}`);
      } else {
        matchDate = new Date(d);
      }
      return matchDate >= today && matchDate <= future &&
        (m.HomeTeam === home || m.AwayTeam === away);
    });

    const exact = upcoming.find(m => 
      (m.HomeTeam === home && m.AwayTeam === away)
    );

    if (exact) return { exists: true, date: exact.Date, time: exact.Time || '' };
    if (upcoming.length > 0) return { exists: false, similar: upcoming.slice(0, 3) };
    return { exists: false };
  }

  if (sport === 'nba') {
    const homeId = NBA_TEAM_IDS[home.toLowerCase()];
    const awayId = NBA_TEAM_IDS[away.toLowerCase()];
    if (!homeId || !awayId) return { exists: false };

    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${homeId}/schedule?season=2026`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + 7);

      const upcoming = (data.events || []).filter(e => {
        const ed = new Date(e.date);
        return ed >= now && ed <= future;
      });

      const exact = upcoming.find(e => {
        const comp = e.competitions[0];
        const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
        return awayTeam?.team?.name?.toLowerCase().includes(away.toLowerCase()) ||
               awayTeam?.team?.displayName?.toLowerCase().includes(away.toLowerCase());
      });

      if (exact) return { exists: true, date: new Date(exact.date).toLocaleDateString('zh-TW') };
      return { exists: false };
    } catch (e) {
      return { exists: false };
    }
  }

  if (sport === 'mlb') {
    const homeId = MLB_TEAM_IDS[home.toLowerCase()];
    const awayId = MLB_TEAM_IDS[away.toLowerCase()];
    if (!homeId || !awayId) return { exists: false };

    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${homeId}/schedule?season=2026`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + 7);

      const upcoming = (data.events || []).filter(e => {
        const ed = new Date(e.date);
        return ed >= now && ed <= future;
      });

      const exact = upcoming.find(e => {
        const comp = e.competitions[0];
        const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
        return awayTeam?.team?.name?.toLowerCase().includes(away.toLowerCase()) ||
               awayTeam?.team?.displayName?.toLowerCase().includes(away.toLowerCase());
      });

      if (exact) return { exists: true, date: new Date(exact.date).toLocaleDateString('zh-TW') };
      return { exists: false };
    } catch (e) {
      return { exists: false };
    }
  }

  return { exists: false };
}
