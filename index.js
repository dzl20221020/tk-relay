import express from "express";
import fetch from "node-fetch"; // Node 18+ 原生支持 fetch，可省略此行

const app = express();

// 1. 允许跨域 (CORS) - 方便前端直接调用
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // 生产环境建议替换为具体域名
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// 从环境变量读取 Relay API Key
const RELAY_KEY = process.env.RELAY_KEY;

app.all("/relay", async (req, res) => {
  // 2. 简单的请求日志
  console.log(`[${new Date().toISOString()}] Incoming Request from: ${req.ip}`);

  // 3. 验证 API Key
  const clientKey = req.headers["x-api-key"];
  if (!RELAY_KEY || clientKey !== RELAY_KEY) {
    console.warn("Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized: invalid relay API key" });
  }

  // 4. 解析参数：支持 method 覆盖
  // 客户端始终发 POST，但在 body 里指定 "method": "GET" 即可转发 GET 请求
  const { url, body, token, "Access-Token": accessToken, method } = req.body || {};
  
  if (!url) return res.status(400).json({ error: "Target URL is required" });

  const cleanToken = (token || accessToken || "").replace(/[\r\n]/g, "").trim();
  if (!cleanToken) return res.status(400).json({ error: "Target Token is required" });

  // 确定最终发给目标 API 的方法 (默认为 POST，除非显式指定 GET/PUT等)
  const targetMethod = (method || req.method).toUpperCase();

  try {
    let fetchUrl = url;
    const fetchOptions = {
      method: targetMethod,
      headers: {
        "Access-Token": cleanToken,
        "Content-Type": "application/json"
      }
    };

    // 5. 根据目标方法处理参数
    // 如果目标是 GET，把 body 参数转为 URL 查询字符串
    if (targetMethod === "GET" && body && Object.keys(body).length > 0) {
      const query = new URLSearchParams(body).toString();
      fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + query;
    } else if (targetMethod !== "GET") {
      // 如果目标是 POST/PUT，把 body 放入请求体
      fetchOptions.body = JSON.stringify(body || {});
    }

    console.log(`Forwarding ${targetMethod} to: ${fetchUrl}`);

    // 发起请求
    const response = await fetch(fetchUrl, fetchOptions);
    
    // 6. 智能解析响应 (防止目标返回非 JSON 导致报错)
    const contentType = response.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text(); // 如果不是 JSON，返回文本
    }

    // 7. 透传目标 API 的状态码
    // 如果 TikTok 返回 400，我们也返回 400，而不是 200
    res.status(response.status).json(result);

  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.toString() });
  }
});

app.get("/", (req, res) => res.send("TikTok API Relay is running."));

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Relay server running on port ${port}`));
