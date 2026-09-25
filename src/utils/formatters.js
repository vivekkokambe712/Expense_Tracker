export function formatCurrency(amount, currency = '₹') {
  const num = Number(amount);
  if (isNaN(num)) return `${currency}0`;

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = absNum.toLocaleString('en-IN', {
    minimumFractionDigits: absNum % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  return `${isNegative ? '-' : ''}${currency}${formatted}`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const isToday = y === todayY && m - 1 === todayM && d === todayD;
  const isYesterday = y === todayY && m - 1 === todayM && d === todayD - 1;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1];

  if (isToday) return `Today, ${d} ${monthName}`;
  if (isYesterday) return `Yesterday, ${d} ${monthName}`;

  if (y === todayY) {
    return `${d} ${monthName}`;
  }
  return `${d} ${monthName} ${y}`;
}

export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
