import dayjs from 'dayjs';

export function generateNumber(prefix, id) {
  const date = dayjs().format('YYYYMMDD');
  return `${prefix}-${date}-${String(id).padStart(4, '0')}`;
}

export function formatCurrency(amount, currency = 'EGP') {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency }).format(amount);
}

export function paginate(query, { page = 1, limit = 25 }) {
  page = Math.max(1, parseInt(page));
  limit = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (page - 1) * limit;
  return {
    query: `${query} LIMIT ${limit} OFFSET ${offset}`,
    page,
    limit,
    offset,
  };
}

export function buildFilters(filters, allowedFields) {
  const conditions = [];
  const values = [];
  for (const [key, val] of Object.entries(filters)) {
    if (val === undefined || val === null || val === '') continue;
    if (!allowedFields.includes(key)) continue;
    if (key === 'search') continue;
    conditions.push(`${key} = ?`);
    values.push(val);
  }
  return { conditions, values };
}

export function searchCondition(search, fields) {
  if (!search) return { condition: '', values: [] };
  const conds = fields.map(f => `${f} LIKE ?`);
  const values = fields.map(() => `%${search}%`);
  return { condition: `(${conds.join(' OR ')})`, values };
}
