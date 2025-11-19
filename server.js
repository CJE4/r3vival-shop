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
const CLOUDFLARE_HASH = "HL_Fwm__tlvUGLZF2p74xw"; // your hash if still using Cloudflare images

if (!LEMON_API_KEY) {
  console.error("Missing LEMON_API_KEY in .env");
  process.exit(1);
}

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

/**
 * Fetch product + variant from Lemon Squeezy and normalize
 */
async function fetchLSProduct(productId, variantId) {
  const url = `${LS_API_BASE}/products/${productId}`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${LEMON_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 12000,
  });

  const product = resp.data.data;
  const variant = product.attributes.variants.find(v => String(v.id) === String(variantId)) || product.attributes.variants[0];

  // handle image URL (if using Cloudflare, otherwise use LS hosted)
  let imageUrl = null;
  if (variant.attributes.image_url) {
    imageUrl = variant.attributes.image_url;
  } else if (product.attributes.images?.length) {
    imageUrl = product.attributes.images[0].attributes.url;
  }

  return {
    id: String(productId),
    variantId: String(variantId),
    name: product.attributes.name ?? `Product ${productId}`,
    price: variant?.attributes.price ?? product.attributes.price ?? null,
    image: {
      url: imageUrl,
      cloudflare_image_id: null,
      raw: variant ?? product ?? null
    },
    description: product.attributes.description ?? "",
    raw: product
  };
}

app.get("/api/product/:productId/:variantId", async (req, res) => {
  const { productId, variantId } = req.params;
  try {
    const product = await fetchLSProduct(productId, variantId);
    res.json(product);
  } catch (err) {
    console.error("Fetch product error:", err?.response?.data || err.message || err);
    res.status(500).json({ error: "Failed to fetch product", details: err?.message || "" });
  }
});

// Batch endpoint: /api/products?list=460427:675063,525502:798910
app.get("/api/products", async (req, res) => {
  const list = req.query.list;
  if (!list) return res.status(400).json({ error: "Provide ?list=productId:variantId,..." });

  const pairs = list.split(",").map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const p of pairs) {
    const [pid, vid] = p.split(":").map(x => x.trim());
    try {
      const product = await fetchLSProduct(pid, vid);
      out.push(product);
    } catch (e) {
      out.push({ id: pid, variantId: vid, error: true, message: e?.message || "fetch error" });
    }
  }
  res.json(out);
});

app.get("/", (req, res) => res.send("Lemon Squeezy proxy running"));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
