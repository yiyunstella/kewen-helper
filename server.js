const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8787);

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

function send(res, status, body, contentType = "application/json") {
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

async function handleOcr(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      send(res, 400, JSON.stringify({ error: "缺少 OPENAI_API_KEY。请先在 .env 文件里填写 API Key。" }));
      return;
    }

    const payload = await readJson(req);
    const images = Array.isArray(payload.images) ? payload.images : [];
    const materialType = payload.materialType === "workbook" ? "workbook" : "lesson";

    if (!images.length) {
      send(res, 400, JSON.stringify({ error: "请先上传至少一张图片。" }));
      return;
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
      send(res, response.status, JSON.stringify({ error: data.error?.message || "OpenAI OCR 请求失败。" }));
      return;
    }

    send(res, 200, JSON.stringify({ text: data.output_text || "" }));
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
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`课文小老师本地服务已启动：http://localhost:${port}`);
});
