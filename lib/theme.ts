// Gedeelde theme utilities voor alle pagina's

export type Mode = "light" | "dark"

export function getStoredMode(): Mode {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem("codesync-theme")
    return (stored === "dark" ? "dark" : "light") as Mode
  } catch {
    return "light"
  }
}

export function storeMode(mode: Mode): void {
  try {
    localStorage.setItem("codesync-theme", mode)
  } catch {}
}

export const THEME = {
  light: {
    bg: "#f5f5f7",
    card: "#ffffff",
    border: "#e5e5ea",
    headerBg: "#ffffff",
    title: "#1c1c1e",
    subtitle: "#8e8e93",
    repo: "#8e8e93",
    arrow: "#c7c7cc",
    secondaryBtn: "#ffffff",
    secondaryBtnBorder: "#e5e5ea",
    secondaryBtnText: "#1c1c1e",
    mutedText: "#8e8e93",
    codeText: "#1c1c1e",
    warningBg: "#fffbeb",
    warningBorder: "#fde68a",
    warningText: "#92400e"
  },
  dark: {
    bg: "#0a0a0f",
    card: "#12121a",
    border: "#1e1e2e",
    headerBg: "#0a0a0f",
    title: "#e8e8f0",
    subtitle: "#5a5a7a",
    repo: "#4a4a6a",
    arrow: "#3a3a5a",
    secondaryBtn: "#12121a",
    secondaryBtnBorder: "#1e1e2e",
    secondaryBtnText: "#e8e8f0",
    mutedText: "#5a5a7a",
    codeText: "#e8e8f0",
    warningBg: "#1a1500",
    warningBorder: "#5a4a00",
    warningText: "#facc15"
  }
}
