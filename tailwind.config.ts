import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                "app-bg": "rgb(var(--app-bg) / <alpha-value>)",
                "app-surface": "rgb(var(--app-surface) / <alpha-value>)",
                "app-card": "rgb(var(--app-card) / <alpha-value>)",
                "app-elevated": "rgb(var(--app-elevated) / <alpha-value>)",
                "app-border": "rgb(var(--app-border) / <alpha-value>)",
                "app-fg": "rgb(var(--app-fg) / <alpha-value>)",
                "app-muted": "rgb(var(--app-muted) / <alpha-value>)",
                "app-subtle": "rgb(var(--app-subtle) / <alpha-value>)",
                "app-primary": "rgb(var(--app-primary) / <alpha-value>)",
                "app-danger": "rgb(var(--app-danger) / <alpha-value>)",
                "app-success": "rgb(var(--app-success) / <alpha-value>)",
            },
        },
    },
    plugins: [],
};
export default config;
