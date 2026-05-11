export const DEFAULT_PALETTE = [
  '#001643', '#00308F', '#004ADC', '#432C00', '#8F5F00', '#DC9200',
  '#F59E0B', '#6366F1', '#14B8A6', '#374151'
];

export function colorForIndex(i:number){ return DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]; }

export function colorForKey(key:string, map=new Map<string,string>()){
  if(map.has(key)) return map.get(key)!;
  const next = DEFAULT_PALETTE[map.size % DEFAULT_PALETTE.length];
  map.set(key, next);
  return next;
}