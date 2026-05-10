const CLOUD_COVERAGE_MAP: Record<string, string> = {
  FEW: 'Mây ít',
  SCT: 'Mây rải rác',
  BKN: 'Mây đứt đoạn',
  OVC: 'Mây toàn phần',
  CLR: 'Trời quang',
  VV: 'Tầm nhìn thẳng đứng',
  NSC: 'Không mây đáng kể',
  NCD: 'Không có mây',
  clear: 'Trời quang',
  CAVOK: 'Trời quang',
};

function extractCloudCode(layer: string): string {
  const trimmed = layer.trim();

  if (trimmed.includes('@')) {
    return trimmed.split('@')[0].trim();
  }

  const match = trimmed.match(/^(FEW|SCT|BKN|OVC|CLR|VV|NSC|NCD)/);
  return match ? match[1] : trimmed;
}

export function formatCloudCover(raw: string | null): string {
  if (!raw || raw.trim() === '') {
    return '—';
  }

  return raw
    .split(',')
    .map((layer) => {
      const code = extractCloudCode(layer);
      return CLOUD_COVERAGE_MAP[code] ?? code;
    })
    .join(', ');
}
