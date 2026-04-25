export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, system } = req.body;
  const key = process.env.ANTHROPIC_KEY;

  if (!key) return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system,
        messages,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "upstream error" });
  }
}
