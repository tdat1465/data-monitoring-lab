'use client';

import React, { createContext, useContext, useState } from 'react';
import { DEFAULT_PALETTE } from './chartPalette';

const ctx = createContext({
  palette: DEFAULT_PALETTE,
  setPalette: (p: string[])=>{},
});
export function ChartThemeProvider({children}:{children:React.ReactNode}){
  const [palette,setPalette] = useState(DEFAULT_PALETTE);
  return <ctx.Provider value={{palette,setPalette}}>{children}</ctx.Provider>;
}
export const useChartTheme = ()=> useContext(ctx);