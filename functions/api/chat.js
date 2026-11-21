// functions/api/chat.js
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.API_KEY || !env.MODEL_NAME) {
      return new Response(
        JSON.stringify({ error: "服务端未配置 API_KEY 或 MODEL_NAME 环境变量" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { intent = "综合", question = "", cards = "" } = await request.json();
    if (!cards) {
      return new Response(
        JSON.stringify({ error: "缺少牌面数据" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 默认指向智谱 v4 端点，若配置了 API_BASE_URL 环境变量则优先使用环境变量
    const baseUrl = (env.API_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/+$/, "");

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
      question ? `求问者困惑：${question}` : `求问者未写具体问题，请就【${intent}】整体推
