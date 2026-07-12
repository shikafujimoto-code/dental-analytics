// api/analyze.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not set' });

  const body = req.body || {};
  const summary = body.summary;
  const type = body.type || 'integrated';
  if (!summary) return res.status(400).json({ error: 'No data' });

  const base = 'あなたは歯科医院経営の専門コンサルタントです。以下のふじもと歯科の経営データを分析してください。\n\n' + summary + '\n\n以下のJSON形式のみで出力してください（前置き不要）:\n{"overall":"総合評価3行","strengths":["強み1","強み2","強み3"],"issues":[{"title":"課題タイトル","detail":"詳細40字","action":"アクション50字"}],"priority":"最優先施策100字"}\nissuesは最大4件。JSONのみ出力。';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: base }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Claude API: ' + errText.slice(0, 300) });
    }

    const data = await response.json();
    let raw = '';
    if (data.content) {
      for (let i = 0; i < data.content.length; i++) {
        if (data.content[i].text) raw += data.content[i].text;
      }
    }
    raw = raw.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Parse failed', raw: raw.slice(0, 200) });

    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
};
