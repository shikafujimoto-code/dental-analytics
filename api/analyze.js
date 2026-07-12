// api/analyze.js — Vercel Serverless Function
// APIキーをサーバー側で安全に管理

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const { summary, type } = req.body;
  if (!summary) return res.status(400).json({ error: 'データがありません' });

  const prompts = {
    integrated: `あなたは歯科医院経営の専門コンサルタントです。
以下のふじもと歯科の経営データ（Apotool & Box + Mic palette統合）を分析してください。

${summary}

以下のJSON形式のみで出力してください（前置き・コードブロック不要）:
{"overall":"総合評価（3行）","strengths":["強み1","強み2","強み3"],"issues":[{"title":"課題タイトル","detail":"詳細（40字）","action":"具体的アクション（50字）"}],"kpi_comments":{"revenue":"売上に関するコメント","cancel":"キャンセルに関するコメント","recall":"リコールに関するコメント","newpt":"新患に関するコメント"},"priority":"最優先で取り組むべき施策（100字）"}
issuesは最大4件。JSONのみ出力。`,
    mic: `あなたは歯科医院経営の専門コンサルタントです。
以下のふじもと歯科のレセコン（Mic palette）データを分析してください。

${summary}

以下のJSON形式のみで出力してください:
{"overall":"総合評価（3行）","strengths":["強み1","強み2","強み3"],"issues":[{"title":"課題タイトル","detail":"詳細（40字）","action":"具体的アクション（50字）"}],"kpi_comments":{"revenue":"売上コメント","jihi":"自費率コメント","rece":"レセプトコメント","newpt":"新患コメント"},"priority":"最優先施策（100字）"}
issuesは最大4件。JSONのみ出力。`,
    apotool: `あなたは歯科医院経営の専門コンサルタントです。
以下のふじもと歯科の予約管理（Apotool & Box）データを分析してください。

${summary}

以下のJSON形式のみで出力してください:
{"overall":"総合評価（3行）","strengths":["強み1","強み2","強み3"],"issues":[{"title":"課題タイトル","detail":"詳細（40字）","action":"具体的アクション（50字）"}],"kpi_comments":{"cancel":"キャンセルコメント","recall":"リコールコメント","maint":"メンテナンスコメント","newpt":"新患コメント"},"priority":"最優先施策（100字）"}
issuesは最大4件。JSONのみ出力。`,
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompts[type] || prompts.integrated }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `APIエラー(${response.status})` });
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI応答の解析に失敗しました', raw: raw.slice(0, 200) });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
