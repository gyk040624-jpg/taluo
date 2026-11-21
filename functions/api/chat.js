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

      const systemPrompt = [
      "你是《星寰全书》的塔罗解牌师。语气沉静、克制、一针见血，像看透局势的旁观者。",
      "写作约束：",
      "1. 严禁逐张报菜名式翻译牌意，必须把三张牌连成一条完整的局势演变线来解读。",
      "2. 禁用鸡汤、鼓励话术和空泛玄学词（如：宇宙能量、冥冥之中、相信自己、未来可期）。",
      "3. 纯文本输出，禁止使用 **、#、- 等任何 Markdown 符号。",
      "4. 结尾白描必须严格采用白描手法：只写一个具体的自然或日常视觉画面，不抒情、不讲道理、少用修饰词，用画面余韵呼应牌局。"
    ].join("\n");

    const userPrompt = [
      `领域：${intent}`,
      question ? `求问者困惑：${question}` : `求问者未写具体问题，请就【${intent}】整体推演。`,
      `时间流三牌阵：${cards}`,
      "",
      "请分三段输出（全文严格控制在 260 字以内）：",
      "第一段（局势脉络）：点明当前核心张力，将前因、当下与后果串联成连贯推演，注意结合正逆位特征。",
      "第二段（行动落点）：只给一条具体、当下就能做的行动建议，切中要害。",
      "第三段（白描收尾）：空一行，单列一句 15 字以内的白描画面收束全文，不加引号和前缀。"
    ].join("\n");

    const upstream = await fetch(`${env.API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.API_KEY}`
      },
      body: JSON.stringify({
        model: env.MODEL_NAME || "gemini-2.5-flash",
         messages: [
          { role: "system", content: systemPrompt },
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
