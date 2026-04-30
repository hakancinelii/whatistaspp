"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
    theme: ThemePreference;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme: ThemePreference) => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.dataset.theme = resolved;
    return resolved;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemePreference>("system");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

    useEffect(() => {
        const stored = localStorage.getItem("theme") as ThemePreference | null;
        const initialTheme = stored && ["light", "dark", "system"].includes(stored) ? stored : "system";
        setThemeState(initialTheme);
        setResolvedTheme(applyTheme(initialTheme));
    }, []);

    useEffect(() => {
        if (theme !== "system") return;

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => setResolvedTheme(applyTheme("system"));
        media.addEventListener("change", handleChange);
        return () => media.removeEventListener("change", handleChange);
    }, [theme]);

    const setTheme = (nextTheme: ThemePreference) => {
        localStorage.setItem("theme", nextTheme);
        setThemeState(nextTheme);
        setResolvedTheme(applyTheme(nextTheme));
    };

    const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
