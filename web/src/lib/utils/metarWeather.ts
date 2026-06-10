export type MetarRainInfo = {
  hasRain: boolean;
  hasShower: boolean;
  hasThunderstormRain: boolean;
  hasDrizzle: boolean;
  hasFreezingRain: boolean;
  intensityPrefix: '-' | '+' | null;
  intensity: 0 | 1 | 2 | 3;
  codes: string[];
  weatherTokens: string[];
};

const VALID_PRESENT_WEATHER_CODES = new Set([
  'MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ',
  'DZ', 'RA', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP',
  'BR', 'FG', 'FU', 'VA', 'DU', 'SA', 'HZ', 'PY',
  'PO', 'SQ', 'FC', 'SS', 'DS',
]);

export function parseMetarWeatherCodes(rawMetar: string | null | undefined): string[] {
  if (!rawMetar) return [];

  const codes: string[] = [];

  String(rawMetar)
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      let clean = token.replace(/^[+-]/, '');
      clean = clean.replace(/^(VC|RE)/, '');

      if (!clean || clean.length % 2 !== 0) return;

      const pieces = clean.match(/.{1,2}/g) ?? [];
      if (pieces.length > 0 && pieces.every((piece) => VALID_PRESENT_WEATHER_CODES.has(piece))) {
        codes.push(...pieces);
      }
    });

  return codes;
}

export function parseMetarWeatherTokens(rawMetar: string | null | undefined): string[] {
  if (!rawMetar) return [];

  const tokens: string[] = [];

  String(rawMetar)
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const intensityPrefix = token.startsWith('-') || token.startsWith('+') ? token[0] : '';
      let clean = token.replace(/^[+-]/, '');
      clean = clean.replace(/^(VC|RE)/, '');

      if (!clean || clean.length % 2 !== 0) return;

      const pieces = clean.match(/.{1,2}/g) ?? [];
      if (pieces.length > 0 && pieces.every((piece) => VALID_PRESENT_WEATHER_CODES.has(piece))) {
        tokens.push(`${intensityPrefix}${clean}`);
      }
    });

  return tokens;
}

export function extractRainFromMetar(rawMetar: string | null | undefined): MetarRainInfo {
  const weatherTokens = parseMetarWeatherTokens(rawMetar);
  const codes = weatherTokens.flatMap((token) => {
    const clean = token.replace(/^[+-]/, '');
    return clean.match(/.{1,2}/g) ?? [];
  });
  const hasRain = codes.includes('RA') || codes.includes('DZ');
  const hasShower = codes.includes('SH');
  const hasThunderstorm = codes.includes('TS');
  const hasDrizzle = codes.includes('DZ');
  const hasFreezingRain = codes.includes('FZ') && hasRain;
  const rainToken = weatherTokens.find((token) => token.includes('RA') || token.includes('DZ'));
  const intensityPrefix = rainToken?.startsWith('-') ? '-' : rainToken?.startsWith('+') ? '+' : null;

  let intensity: 0 | 1 | 2 | 3 = 0;
  if (hasRain) intensity = 1;
  if (hasRain && hasShower) intensity = 2;
  if (hasRain && hasThunderstorm) intensity = 3;

  return {
    hasRain,
    hasShower: hasShower && hasRain,
    hasThunderstormRain: hasThunderstorm && hasRain,
    hasDrizzle,
    hasFreezingRain,
    intensityPrefix,
    intensity,
    codes,
    weatherTokens,
  };
}
