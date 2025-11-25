import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/relay", async (req, res) => {
  const { url, token, body } = req.body;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Relay running on port ${port}`));
