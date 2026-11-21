"use client";
/* Theme trang khách cho component phía trình duyệt (vd. header riêng của trình chỉnh cần logo / màu header). ThemeShell cung cấp. */
import { createContext, useContext } from "react";
import type { Theme } from "@/lib/theme";

const Ctx = createContext<Theme | null>(null);
export const ThemeProvider = ({ value, children }: { value: Theme; children: React.ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useSiteTheme = () => useContext(Ctx);
