const CLOUD_COVERAGE_MAP: Record<string, string> = {
  FEW: 'Mây ít',
  SCT: 'Mây rải rác',
  BKN: 'Mây đứt đoạn',
  OVC: 'Mây toàn phần',
  CLR: 'Trời quang',
  VV: 'Tầm nhìn thẳng đứng',
  NSC: 'Không mây đáng kể',
  NCD: 'Không có mây',
};

export function formatCloudCover(raw: string | null): string {
  if (!raw || raw.trim() === '') {
    return '—';
  }

  return raw
    .split(',')
    .map((layer) => {
      const code = layer.trim().split('@')[0].trim();
      return CLOUD_COVERAGE_MAP[code] ?? code;
    })
    .join(', ');
}
