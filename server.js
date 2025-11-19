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
const SHOP_ID = process.env.SHOP_ID;
const SELLAUTH_KEY = process.env.SELLAUTH_PRIVATE_KEY;

const CLOUDFLARE_HASH = "HL_Fwm__tlvUGLZF2p74xw"; // your hash

if (!SHOP_ID || !SELLAUTH_KEY) {
  console.error("Missing SHOP_ID or SELLAUTH_PRIVATE_KEY in .env");
  process.exit(1);
}

const SELLAUTH_API_BASE = "https://api.sellauth.com/v1";

/**
 * Fetch product + variant from SellAuth and normalize
 */
async function fetchProduct(productId, variantId) {
  const url = `${SELLAUTH_API_BASE}/products/${productId}`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${SELLAUTH_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 12000,
  });

  const product = resp.data;

  let variant = null;
  if (Array.isArray(product.variants)) {
    variant = product.variants.find(v => String(v.id) === String(variantId)) || product.variants[0];
  }

  let imageObj = null;
  if (product.image) imageObj = product.image;
  else if (product.images?.length) imageObj = product.images[0];
  else if (product.media?.length) imageObj = product.media[0];

  const cloudflareId = imageObj?.cloudflare_image_id ?? imageObj?.cloudflare_id ?? null;
  const imageUrl = cloudflareId ? `https://imagedelivery.net/${CLOUDFLARE_HASH}/${cloudflareId}/public` : (imageObj?.url || null);

  return {
    id: String(productId),
    variantId: String(variantId),
    name: product.name ?? product.title ?? `Product ${productId}`,
    price: variant?.price ?? product.price ?? null,
    image: {
      url: imageUrl,
      cloudflare_image_id: cloudflareId,
      raw: imageObj ?? null
    },
    description: product.description ?? "",
    raw: product
  };
}

app.get("/api/product/:productId/:variantId", async (req, res) => {
  const { productId, variantId } = req.params;
  try {
    const product = await fetchProduct(productId, variantId);
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
      const product = await fetchProduct(pid, vid);
      out.push(product);
    } catch (e) {
      out.push({ id: pid, variantId: vid, error: true, message: e?.message || "fetch error" });
    }
  }
  res.json(out);
});

app.get("/", (req, res) => res.send("SellAuth proxy running"));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
