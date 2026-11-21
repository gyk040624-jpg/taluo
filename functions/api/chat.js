// functions/api/chat.js
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { intent = "综合", question = "", cards = "" } = await request.json();

    if (!cards) {
      return new Response(JSON.stringify({ error: "缺少牌面数据" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const userPrompt = [
      `占卜领域：${intent}`,
      question ? `求问者具体困惑：${question}` : `求问者未输入具体问题，请结合【${intent}】领域整体推演。`,
      `抽取牌阵（时间流三牌阵）：${cards}`,
      `请按以下结构给出解读：1. 牌面能量总览；2. 前因—当下—后果的因果脉络拆解；3. 一条具体可落地的行动建议。语言克制、有洞察力，避免空泛鸡汤，字数控制在 350 字以内，最后结合解读给出一句简短白描。`
    ].join('\n');

    const upstream = await fetch(`${env.API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.API_KEY}`
      },
      body: JSON.stringify({
        model: env.MODEL_NAME || "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "你是《星寰全书》的塔罗解牌师。你擅长从象征学与心理投射角度剖析牌阵联系，语气沉静、精准、有分寸感。"
          },
          { role: "user", content: userPrompt }
        ],
        stream: true
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ error: `上游接口异常: ${upstream.status}`, detail: errText }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
