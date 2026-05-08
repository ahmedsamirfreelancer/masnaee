import dayjs from 'dayjs';

export function formatCurrency(amount) {
  if (amount == null) return '0 ج.م';
  return new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ج.م';
}

export function formatNumber(num) {
  if (num == null) return '0';
  return new Intl.NumberFormat('ar-EG').format(num);
}

export function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('YYYY/MM/DD');
}

export function formatDateTime(date) {
  if (!date) return '-';
  return dayjs(date).format('YYYY/MM/DD HH:mm');
}

export function formatPercent(val) {
  if (val == null) return '0%';
  return `${Number(val).toFixed(1)}%`;
}
