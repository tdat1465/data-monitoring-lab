export function formatDelay(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const m = Math.round(minutes);
  if (m < 0) return `Sớm ${Math.abs(m)} phút`;
  if (m === 0) return 'Đúng giờ';
  if (m < 15) return `+${m} phút`;
  return `Trễ ${m} phút`;
}

export function delayColor(minutes: number | null | undefined): string {
  if (minutes == null) return 'text-gray-400';
  if (minutes < 5) return 'text-green-600';
  if (minutes < 15) return 'text-yellow-600';
  if (minutes < 30) return 'text-orange-600';
  return 'text-red-600';
}

export function delayBadgeClass(minutes: number | null | undefined): string {
  if (minutes == null) return 'bg-gray-100 text-gray-500';
  if (minutes < 5) return 'bg-green-100 text-green-800';
  if (minutes < 15) return 'bg-yellow-100 text-yellow-800';
  if (minutes < 30) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}
