// run: node get_variants.js
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const API_KEY = '5331471|gwIVEwS6WTr8TjeMfijPXgYsO5gGv8LrQAnlbDDjb0d69233';
const SHOP_ID = '179365';

if (!API_KEY || !SHOP_ID) {
  console.error("❌ Error: SELLAUTH_KEY or STORE_ID missing in .env");
  process.exit(1);
}

const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "Default";

const fetchProducts = async (page = 1, perPage = 100) => {
  try {
    const res = await axios.get(
      `https://api.sellauth.com/v1/shops/${SHOP_ID}/products?page=${page}&perPage=${perPage}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );
    return res.data.data || [];
  } catch (error) {
    throw new Error(error.response ? JSON.stringify(error.response.data) : error.message);
  }
};

const fetchAllProducts = async () => {
  let allProducts = [];
  let page = 1;
  let more = true;

  while (more) {
    const products = await fetchProducts(page);
    if (!products || products.length === 0) {
      more = false;
      break;
    }
    allProducts = allProducts.concat(products);
    page++;
  }

  return allProducts;
};

(async () => {
  try {
    const products = await fetchAllProducts();

    const output = products.map(prod => {
      const variants = (prod.variants || []).map(v => {
        // Use the correct property for size
        const size = v.size || v.name || "Default";  
        return `  - ${capitalize(size)}: ${v.id}`;
      }).join('\n');

      return `Product Name: ${prod.name}\nProduct ID: ${prod.id}\nImage: ${prod.image_url || "No image available"}\nVariants:\n${variants || "  - Default variant"}\n`;
    }).join('\n');

    fs.writeFileSync('sellauth_products_variants.txt', output);
    console.log('✅ File written: sellauth_products_variants.txt');
  } catch (error) {
    console.error("❌ Error fetching products:", error.message);
  }
})();