"use client";

import { useEffect, useState } from "react";

const themeStorageKey = "check-my-cream-theme";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = window.localStorage.getItem(themeStorageKey);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    const currentTheme = document.documentElement.dataset.theme;
    if (currentTheme === "light" || currentTheme === "dark") {
      return currentTheme;
    }

    return getSystemTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  function handleToggle() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={handleToggle}
      aria-label="Переключить тему"
      title={theme === "dark" ? "Светлая тема" : "Темная тема"}
    >
      <span aria-hidden="true" className="theme-toggle-icon theme-toggle-icon-moon">🌙</span>
      <span aria-hidden="true" className="theme-toggle-icon theme-toggle-icon-sun">☀️</span>
    </button>
  );
}
