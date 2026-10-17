import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative"
    >
      <Sun className={`h-5 w-5 transition-all ${isDark ? "scale-0 -rotate-90" : "scale-100 rotate-0"}`} />
      <Moon className={`absolute h-5 w-5 transition-all ${isDark ? "scale-100 rotate-0" : "scale-0 rotate-90"}`} />
    </Button>
  );
}
