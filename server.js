// server.js
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LEMON_API_KEY = process.env.LEMON_API_KEY;

if (!LEMON_API_KEY) {
  console.error("Missing LEMON_API_KEY in .env");
  process.exit(1);
}

// Lemon Squeezy API base
const LEMON_BASE = "https://api.lemonsqueezy.com/v1";

/**
 * Create Lemon Squeezy checkout session
 * items = [{ variant: 'variantId', quantity: 1 }, ...]
 */
app.post("/api/create-checkout", async (req, res) => {
  const items = req.body.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
    const payload = {
      checkout: {
        line_items: items.map(i => ({
          variant_id: i.variant,
          quantity: i.quantity
        })),
        // Optional: redirect URL after checkout
        success_url: req.body.success_url || "https://yourdomain.com/thank-you"
      }
    };

    const response = await axios.post(`${LEMON_BASE}/checkouts`, payload, {
      headers: {
        Authorization: `Bearer ${LEMON_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const checkoutId = response.data.data?.id;
    res.json({ checkoutId });
  } catch (err) {
    console.error("Lemon Squeezy checkout error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Failed to create checkout", details: err.message });
  }
});

app.get("/", (req, res) => res.send("Lemon Squeezy proxy running"));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
