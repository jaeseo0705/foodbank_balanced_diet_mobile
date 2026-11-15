export const inventoryCollections = ['products', 'donations', 'provisions', 'disposals', 'transfers', 'adjustments', 'splits', 'sets'] as const;
export type InventoryCollection = typeof inventoryCollections[number];
type Row = Record<string, any>;
export type InventoryItem = { id: string; name: string; barcode: string; category: string; unit: string; quantity: number };

// Keep quantities consistent with FMS store.stock()/inventory(). Receipts are
// acknowledgements, not additional stock; storage-location moves do not change totals.
export function buildInventory(source: unknown): InventoryItem[] {
  if (!source || typeof source !== 'object') throw Error('FMS 재고 자료 형식을 확인해 주세요.');
  const db = source as Record<InventoryCollection, Row[]>;
  for (const key of inventoryCollections) {
    if (!Array.isArray(db[key]) || db[key].some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('FMS 재고 자료 형식을 확인해 주세요.');
  }
  const balances = new Map<string, number>();
  const products = new Map<string, Row>();
  const round = (value: number) => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
  for (const product of db.products) {
    if (!['string', 'number'].includes(typeof product.id) || typeof product.name !== 'string') throw Error('FMS 물품 자료 형식을 확인해 주세요.');
    products.set(String(product.id), product);
  }
  function numeric(value: unknown): number {
    if (value === '' || value === null || value === undefined || typeof value === 'boolean') throw Error('FMS 입출고 수량을 확인해 주세요.');
    const number = Number(value);
    if (!Number.isFinite(number)) throw Error('FMS 입출고 수량을 확인해 주세요.');
    return number;
  }
  function change(id: unknown, quantity: number) {
    const key = String(id);
    if (!products.has(key)) throw Error('입출고 내역의 물품 정보를 찾을 수 없습니다.');
    const next = round((balances.get(key) ?? 0) + quantity);
    if (!Number.isFinite(next)) throw Error('FMS 입출고 수량을 확인해 주세요.');
    balances.set(key, next);
  }
  function lines(record: Row): Row[] {
    if (record.items == null) return [];
    if (!Array.isArray(record.items) || record.items.some((line: unknown) => !line || typeof line !== 'object' || Array.isArray(line))) throw Error('FMS 입출고 자료 형식을 확인해 주세요.');
    return record.items;
  }
  for (const [key, sign] of [['donations', 1], ['provisions', -1], ['disposals', -1], ['transfers', -1]] as const) {
    for (const record of db[key]) {
      if (record.status === '취소') continue;
      if (key === 'transfers' && record.direction === 'in' && record.status !== '확정') continue;
      const direction = key === 'transfers' && record.direction === 'in' ? 1 : sign;
      for (const line of lines(record)) change(line.productId, direction * numeric(line.quantity));
    }
  }
  for (const record of db.adjustments) if (record.status !== '취소') change(record.productId, numeric(record.quantity));
  for (const record of db.splits) {
    if (record.status === '취소') continue;
    change(record.productId, -numeric(record.quantity));
    change(record.targetProductId, numeric(record.targetQuantity));
  }
  for (const record of db.sets) {
    if (record.status === '취소') continue;
    const count = numeric(record.quantity);
    for (const line of lines(record)) change(line.productId, -numeric(line.quantity) * count);
    change(record.productId, count);
  }
  return db.products.map(product => ({
    id: String(product.id), name: product.name, barcode: String(product.barcode ?? ''),
    category: String(product.category ?? ''), unit: String(product.unit ?? ''),
    quantity: Math.max(0, balances.get(String(product.id)) ?? 0),
  }));
}
