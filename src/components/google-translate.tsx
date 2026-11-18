// src/components/google-translate.tsx
import { useEffect } from "react"

const RTL_LANGUAGES = ["ar", "he", "ur", "fa", "yi", "ps", "sd"]

declare global {
  interface Window {
    google: any
    googleTranslateElementInit: () => void
  }
}

function updateDirection() {
  const currentLang = document.documentElement.getAttribute("lang")
  const isRTL = RTL_LANGUAGES.includes(currentLang || "")
  document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr")
}

export function GoogleTranslate() {
  useEffect(() => {
    // Load the Google Translate script only once
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script")
      script.id = "google-translate-script"
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      script.async = true
      document.body.appendChild(script)
    }

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", autoDisplay: false },
        "google_translate_element"
      )
    }

    // Watch <html lang="..."> for changes and flip direction
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "lang") {
          updateDirection()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    updateDirection() // run once on mount too

    return () => observer.disconnect()
  }, [])

  return <div id="google_translate_element" />
}