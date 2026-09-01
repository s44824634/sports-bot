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
  console.log(`✅ 足球數據載入完成: ${footballData.length} 場比賽`);
  return footballData;
}

function getTeamStats(matches, teamName, isHome = null, lastN = 5) {
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

function getHeadToHead(matches, home, away, lastN = 3) {
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

// ========== NBA / MLB ESPN API ==========
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
