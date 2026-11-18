// src/hooks/use-auto-direction.ts
import { useEffect } from "react"

const RTL_LANGUAGES = ["ar", "he", "ur", "fa", "yi", "ps", "sd", "ku", "dv"]

function applyDirection(lang: string | null) {
  const isRTL = RTL_LANGUAGES.some((code) => lang?.startsWith(code))
  document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr")
}

export function useAutoDirection() {
  useEffect(() => {
    // Run once immediately, in case browser already translated before mount
    applyDirection(document.documentElement.getAttribute("lang"))

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "lang") {
          applyDirection(document.documentElement.getAttribute("lang"))
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  }, [])
}