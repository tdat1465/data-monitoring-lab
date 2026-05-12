import { delayBadgeClass } from '@/lib/utils/formatDelay';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    on_time: 'bg-green-100 text-green-800',
    delayed: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-600',
    enroute: 'bg-blue-100 text-blue-800',
    other: 'bg-gray-100 text-gray-600',
    landed: 'bg-gray-200 text-gray-500',
    departed: 'bg-gray-200 text-gray-500',
    cancelled: 'bg-red-200 text-red-800',
  };

  const label: Record<string, string> = {
    on_time: 'Đúng giờ',
    delayed: 'Trễ',
    unknown: 'Chưa rõ',
    enroute: 'Đang bay',
    other: 'Khác',
    landed: 'Đã hạ cánh',
    departed: 'Đã cất cánh',
    cancelled: 'Hủy',
  };

  return (
    <Badge className={map[status] ?? 'bg-gray-100 text-gray-600'}>
      {label[status] ?? status}
    </Badge>
  );
}

export function DelayBadge({ minutes }: { minutes: number | null | undefined }) {
  const text =
    minutes == null
      ? '—'
      : minutes < 0
        ? `Sớm ${Math.abs(Math.round(minutes))}p`
        : minutes === 0
          ? 'Đúng giờ'
          : `Trễ ${Math.round(minutes)}p`;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${delayBadgeClass(minutes)}`}>
      {text}
    </span>
  );
}
