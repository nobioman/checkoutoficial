import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.env.DATABASE_PATH || './data/orders.json');
function ensureStore() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({ orders: [] }, null, 2));
}
function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeStore(data) {
  ensureStore();
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, filePath);
}
export function initDb() { ensureStore(); }
export function saveOrder(o) {
  const data = readStore();
  if (data.orders.some(x => x.provider_id === o.providerId)) throw new Error('Transação já registrada.');
  data.orders.push({
    id:o.id, provider_id:o.providerId, product_id:o.productId, product_name:o.productName,
    amount:o.amount, customer:o.customer, status:o.status, provider_response:o.providerResponse,
    created_at:new Date().toISOString(), updated_at:new Date().toISOString()
  });
  writeStore(data);
}
export function getOrder(id) { return readStore().orders.find(o => o.id === id) || null; }
export function findOrderByProviderId(providerId) { return readStore().orders.find(o => o.provider_id === providerId) || null; }
export function updateOrderStatus(id, status, providerResponse) {
  const data=readStore(); const order=data.orders.find(o=>o.id===id);
  if (!order) return;
  order.status=status; order.provider_response=providerResponse; order.updated_at=new Date().toISOString();
  writeStore(data);
}
