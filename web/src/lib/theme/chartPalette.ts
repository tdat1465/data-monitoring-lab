export const DEFAULT_PALETTE = [
  '#F4F1DE', '#EAB69F', '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F',
  '#F59E0B', '#dc6e50', '#e75f39', '#f1cfc0', '#73aa8f',
];

export function colorForIndex(i:number){ return DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]; }

export function colorForKey(key:string, map=new Map<string,string>()){
  if(map.has(key)) return map.get(key)!;
  const next = DEFAULT_PALETTE[map.size % DEFAULT_PALETTE.length];
  map.set(key, next);
  return next;
}