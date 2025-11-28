import express from "express";
import fetch from "node-fetch"; // 如果使用 Node.js 18+，这行可以注释掉

const app = express();

// 1. 允许跨域 (CORS)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const RELAY_KEY = process.env.RELAY_KEY;

app.all("/relay", async (req, res) => {
  console.log(`[${new Date().toISOString()}] Incoming Request from: ${req.ip}`);

  // 2. 验证中转服务的 API Key
  const clientKey = req.headers["x-api-key"];
  if (!RELAY_KEY || clientKey !== RELAY_KEY) {
    console.warn("Unauthorized access attempt");
    return res.status(401).json({ error: "Unauthorized: invalid relay API key" });
  }

  // 3. 解析请求参数
  const { url, body, token, "Access-Token": accessToken, method } = req.body || {};
  
  if (!url) return res.status(400).json({ error: "Target URL is required" });

  const cleanToken = (token || accessToken || "").replace(/[\r\n]/g, "").trim();
  if (!cleanToken) return res.status(400).json({ error: "Target Token is required" });

  // 确定目标请求方法 (默认为 POST)
  const targetMethod = (method || req.method).toUpperCase();

  try {
    let fetchUrl = url;
    const fetchOptions = {
      method: targetMethod,
      headers: {
        "Access-Token": cleanToken, // TikTok Marketing API 通常用 Access-Token
        "Content-Type": "application/json"
      }
    };

    // 4. 【关键修改】智能处理 GET 参数
    if (targetMethod === "GET" && body && Object.keys(body).length > 0) {
      const params = new URLSearchParams();
      
      // 遍历 body 中的每个字段
      for (const [key, value] of Object.entries(body)) {
        if (value === null || value === undefined) continue;

        if (typeof value === "object") {
          // 如果是数组或对象 (例如 dimensions, metrics)，自动转为 JSON 字符串
          // 这样客户端就可以直接传 ["ad_id"] 而不需要传 "[\"ad_id\"]"
          params.append(key, JSON.stringify(value));
        } else {
          // 普通数字或字符串直接添加
          params.append(key, value);
        }
      }
      
      const queryString = params.toString();
      fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + queryString;

    } else if (targetMethod !== "GET") {
      // POST/PUT 请求直接发送 JSON body
      fetchOptions.body = JSON.stringify(body || {});
    }

    console.log(`Forwarding ${targetMethod} to: ${fetchUrl}`);

    // 5. 发起请求
    const response = await fetch(fetchUrl, fetchOptions);
    
    // 6. 处理响应
    const contentType = response.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    // 透传状态码
    res.status(response.status).json(result);

  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.toString() });
  }
});

app.get("/", (req, res) => res.send("TikTok API Relay is running."));

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Relay server running on port ${port}`));
