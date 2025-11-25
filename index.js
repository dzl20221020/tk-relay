import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 从环境变量读取 Relay API Key
const RELAY_KEY = process.env.RELAY_KEY;

// Relay 接口：支持 GET/POST
app.all("/relay", async (req, res) => {
  // 验证 API Key
  const clientKey = req.headers["x-api-key"];
  if (!RELAY_KEY || clientKey !== RELAY_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid API key" });
  }

  // 获取请求参数
  const { url, body, token, "Access-Token": accessToken } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL is required" });

  const cleanToken = (token || accessToken || "").replace(/[\r\n]/g, "").trim();
  if (!cleanToken) return res.status(400).json({ error: "Token is required" });

  try {
    // 构造 fetch 参数
    let fetchUrl = url;
    const fetchOptions = {
      method: req.method, // 保持客户端方法
      headers: {
        "Access-Token": cleanToken,
        "Content-Type": "application/json"
      }
    };

    if (req.method === "GET" && body) {
      const query = new URLSearchParams(body).toString();
      fetchUrl += "?" + query;
    } else if (req.method !== "GET") {
      fetchOptions.body = JSON.stringify(body || {});
    }

    const response = await fetch(fetchUrl, fetchOptions);
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// 根路径提示信息
app.get("/", (req, res) => res.send("TikTok API Relay running. Use /relay with x-api-key header."));

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Relay running on port ${port}`));
