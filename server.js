const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8787);

let baiduTokenCache = {
  token: "",
  expiresAt: 0
};

loadEnv();

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, safePath));
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };
  send(res, 200, fs.readFileSync(filePath), types[ext] || "application/octet-stream");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 60 * 1024 * 1024) {
        reject(new Error("请求图片太大，请减少图片数量或压缩后再试。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

async function getBaiduAccessToken() {
  const now = Date.now();
  if (baiduTokenCache.token && baiduTokenCache.expiresAt > now + 60_000) {
    return baiduTokenCache.token;
  }

  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("缺少 BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY。请先在 .env 文件里填写。");
  }

  const url = new URL("https://aip.baidubce.com/oauth/2.0/token");
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("client_secret", secretKey);

  const response = await fetch(url, { method: "POST" });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "获取百度 OCR access_token 失败。");
  }

  baiduTokenCache = {
    token: data.access_token,
    expiresAt: now + Number(data.expires_in || 2_000_000) * 1000
  };
  return baiduTokenCache.token;
}

async function baiduOcrImage(dataUrl) {
  const token = await getBaiduAccessToken();
  const endpoint = process.env.BAIDU_OCR_ENDPOINT || "accurate_basic";
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/${endpoint}?access_token=${encodeURIComponent(token)}`;
  const body = new URLSearchParams();
  body.set("image", dataUrlToBase64(dataUrl));
  body.set("paragraph", "true");
  body.set("detect_direction", "true");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json();
  if (!response.ok || data.error_code) {
    throw new Error(data.error_msg || "百度 OCR 识别失败。");
  }

  if (Array.isArray(data.paragraphs_result) && Array.isArray(data.words_result)) {
    return data.paragraphs_result
      .map(paragraph => paragraph.words_result_idx
        .map(index => data.words_result[index]?.words)
        .filter(Boolean)
        .join("")
      )
      .filter(Boolean)
      .join("\n");
  }

  return (data.words_result || [])
    .map(item => item.words)
    .filter(Boolean)
    .join("\n");
}

async function openaiOcrImages(images, materialType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY。");
  }

  const prompt = materialType === "workbook"
    ? [
        "请对这些小学语文练习册图片做 OCR。",
        "按图片顺序合并输出。",
        "只输出可编辑文字，不要解释。",
        "尽量保留题号、题干、选项、表格结构和孩子已经写的答案。",
        "如果某处看不清，用 [看不清] 标注。"
      ].join("\n")
    : [
        "请对这些小学语文课文图片做 OCR。",
        "按图片顺序合并输出完整课文。",
        "只输出可编辑文字，不要解释。",
        "保留课题、自然段和课文正文。",
        "忽略手写圈画、批注和页码；如果某处看不清，用 [看不清] 标注。"
      ].join("\n");

  const content = [
    { type: "input_text", text: prompt },
    ...images.map(image => ({
      type: "input_image",
      image_url: image.dataUrl,
      detail: "high"
    }))
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini",
      input: [{ role: "user", content }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI OCR 请求失败。");
  }
  return data.output_text || "";
}

async function deepseekCleanOcr(rawText, materialType) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return rawText;

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const system = materialType === "workbook"
    ? [
        "你是小学语文练习册整理助手。",
        "输入是 OCR 出来的练习册文本，包含识别噪声。请输出干净、可直接编辑的题目文本。",
        "规则：",
        "1. 删除生字注音行（独立成行的 yì shè、sāng、zhì 这种全拼音音节，且没有汉字）。",
        "2. 删除单元名（“第八单元·阅读”）、页码（独立的数字 100）、单独的“①”脚注序号。",
        "3. 删除底部小字注释段（如“①本文根据《山海经…》改写”、“①本文选自人民教育出版社…”）。",
        "4. 题目本身要保留题号、题干、选项、表格结构、孩子已经写的答案。",
        "5. 不同题目之间用空行分隔；同一题被 OCR 拆成多行的，按语义合并成一段。",
        "6. 不要解释、不要 markdown，直接输出整理后的题目文本。"
      ].join("\n")
    : [
        "你是小学语文课文整理助手。",
        "输入是 OCR 出来的课文文本，包含识别噪声。请输出干净、可直接编辑的课文原文。",
        "规则：",
        "1. 删除生字注音行（独立成行的 yì shè、sāng、zhì、zhí、xí 这种纯拼音音节，且没有汉字）。",
        "2. 删除单元名（如“第八单元·阅读”）、页码（独立的数字 100）、课文编号（如开头的 22）。",
        "3. 删除底部小字注释段（如“①本文根据《山海经·海外东经》和《淮南子·本经训》相关内容改写”、“①本文选自人民教育出版社…”）。",
        "4. 课文正文不要因为书本视觉换行就另起一行——以句号、问号、感叹号结束且语义结束才另起一段；同一自然段被 OCR 拆成多行的，按语义合并成一段。",
        "5. 自然段之间用一个空行分隔，段落开头不加缩进空格。",
        "6. 保留课文标题（去掉编号，例如“22 羿射九日”输出为“羿射九日”）。",
        "7. 不要解释、不要 markdown、不要给拼音、不要给注释，直接输出整理后的课文。"
      ].join("\n");

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: rawText }
        ],
        temperature: 0.1
      })
    });
    const data = await response.json();
    if (!response.ok) return rawText;
    const cleaned = data.choices?.[0]?.message?.content;
    return (typeof cleaned === "string" && cleaned.trim()) ? cleaned.trim() : rawText;
  } catch (err) {
    return rawText;
  }
}

async function deepseekPractice(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。请先在 .env 填写。");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const lessonTitle = payload.lessonTitle || "";
  const lessonText = payload.lessonText || "";
  const level = payload.level === "easy" ? "轻度"
    : payload.level === "hard" ? "重度" : "中度";
  const showPinyin = payload.showPinyin !== false;

  const system = [
    "你是小学语文老师，正在为家长生成可打印的填空默写练习。",
    "必须严格按 JSON 输出，不要解释，不要 markdown 代码块，不要包裹任何额外文本。",
    "输出格式：{\"blanks\":[{\"word\":\"洪水\",\"pinyin\":\"hóng shuǐ\"}, ...]}",
    "规则：",
    "1. 选词只从给定课文原文中挑，不能臆造课文里没有的词。",
    "2. 优先 2 到 3 字重点词；4 字成语谨慎，超过 4 字不要选。",
    "3. 服务“会写课文字词”：优先选生字词、动词、名词、易错词，不要挑助词、连词、代词。",
    "4. 拼音必须带声调（hóng shuǐ 而不是 hong shui），词内空格分隔。",
    "5. 轻度 6-8 个，中度 10-14 个，重度 16-22 个；同一个词只出现一次。",
    "6. 按词在课文中第一次出现的顺序排列。"
  ].join("\n");

  const user = [
    `课文标题：${lessonTitle || "（未填写）"}`,
    `难度：${level}`,
    `是否需要拼音：${showPinyin ? "是" : "否（pinyin 字段可留空字符串）"}`,
    "课文原文：",
    lessonText
  ].join("\n");

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "DeepSeek 请求失败。");
  }
  const text = data.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("DeepSeek 返回的不是合法 JSON：" + text.slice(0, 200));
  }
  const blanks = Array.isArray(parsed.blanks) ? parsed.blanks : [];
  return blanks
    .filter(item => item && typeof item.word === "string" && item.word.trim())
    .map(item => ({
      word: item.word.trim(),
      pinyin: typeof item.pinyin === "string" ? item.pinyin.trim() : ""
    }));
}

async function handlePractice(req, res) {
  try {
    const payload = await readJson(req);
    if (!payload.lessonText || !payload.lessonText.trim()) {
      send(res, 400, JSON.stringify({ error: "请先填写或 OCR 出课文原文。" }));
      return;
    }
    const blanks = await deepseekPractice(payload);
    send(res, 200, JSON.stringify({ blanks }));
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message || "练习生成失败。" }));
  }
}

async function handleOcr(req, res) {
  try {
    const payload = await readJson(req);
    const images = Array.isArray(payload.images) ? payload.images : [];
    const materialType = payload.materialType === "workbook" ? "workbook" : "lesson";
    const provider = (process.env.OCR_PROVIDER || "baidu").toLowerCase();

    if (!images.length) {
      send(res, 400, JSON.stringify({ error: "请先上传至少一张图片。" }));
      return;
    }

    let text = "";
    if (provider === "openai") {
      text = await openaiOcrImages(images, materialType);
    } else {
      const parts = [];
      for (let i = 0; i < images.length; i += 1) {
        const pageText = await baiduOcrImage(images[i].dataUrl);
        parts.push(pageText.trim());
      }
      text = parts.filter(Boolean).join("\n\n");
    }

    const useClean = (process.env.OCR_CLEAN || "on").toLowerCase() !== "off";
    let cleaned = text;
    if (useClean && process.env.DEEPSEEK_API_KEY) {
      cleaned = await deepseekCleanOcr(text, materialType);
    }

    send(res, 200, JSON.stringify({ text: cleaned, rawText: text }));
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message || "OCR 服务异常。" }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }
  if (req.method === "POST" && req.url === "/api/ocr") {
    handleOcr(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/practice") {
    handlePractice(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`课文小老师本地服务已启动：http://localhost:${port}`);
  console.log(`当前 OCR_PROVIDER=${process.env.OCR_PROVIDER || "baidu"}`);
});
