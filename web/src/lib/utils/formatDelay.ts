export function formatDelay(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const m = Math.round(minutes);
  if (m < 0) return `Sớm ${Math.abs(m)} phút`;
  if (m === 0) return 'Đúng giờ';
  return `Trễ ${m} phút`;
}

export function delayColor(minutes: number | null | undefined): string {
  if (minutes == null) return 'text-gray-400';
  if (minutes < 0) return 'text-blue-600'; // sớm
  if (minutes === 0) return 'text-green-600'; // đúng giờ
  return 'text-red-600'; // trễ
}

export function delayBadgeClass(minutes: number | null | undefined): string {
  if (minutes == null) return 'bg-gray-100 text-gray-500';
  if (minutes < 0) return 'bg-blue-100 text-blue-800'; // sớm
  if (minutes === 0) return 'bg-green-100 text-green-800'; // đúng giờ
  return 'bg-red-100 text-red-800'; // trễ
}
