import { pageBgStyle, themeCss } from "@/lib/theme";
import { getTheme } from "@/lib/themeLoad";
import { ThemeProvider } from "./ThemeContext";

// Khung trang khách có Theme: biến màu (ghi đè :root) + nền trang (màu / ảnh)
export async function ThemeShell({ className, children }: { className: string; children: React.ReactNode }) {
  const t = await getTheme();
  const css = themeCss(t);
  return (
    <div className={className} style={pageBgStyle(t)}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <ThemeProvider value={t}>{children}</ThemeProvider>
    </div>
  );
}
