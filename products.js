import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");

// In a real system, replace this with a database or API call.
function loadProducts() {
  const raw = readFileSync(PRODUCTS_PATH, "utf-8");
  return JSON.parse(raw);
}

export function searchProducts(query) {
  const products = loadProducts();
  const q = query.toLowerCase();
  const results = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  );
  // Return a trimmed view so the model isn't flooded with tokens
  return results.map(({ sku, name, category, price, currency, stock }) => ({
    sku,
    name,
    category,
    price,
    currency,
    in_stock: stock > 0,
  }));
}

export function getProductDetails(sku) {
  const products = loadProducts();
  const product = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  if (!product) {
    return { error: `No product found with SKU ${sku}` };
  }
  return product;
}

export function checkStock(sku) {
  const products = loadProducts();
  const product = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  if (!product) {
    return { error: `No product found with SKU ${sku}` };
  }
  return { sku: product.sku, name: product.name, stock: product.stock };
}
