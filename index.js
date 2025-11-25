import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/relay", async (req, res) => {
  const { url, body, token, "Access-Token": accessToken } = req.body;
  const cleanToken = (token || accessToken || "").replace(/[\r\n]/g, "").trim();

  if (!cleanToken) return res.status(400).json({ error: "Token is required" });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Access-Token": cleanToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.get("/", (req, res) => res.send("TikTok API Relay running. Use POST /relay."));
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Relay running on port ${port}`));
