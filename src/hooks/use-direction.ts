// import { useEffect } from 'react'
// import { useTranslation } from 'react-i18next'
// import { RTL_LANGUAGES } from '@/i18n'

// export function useDirection() {
//   const { i18n } = useTranslation()

//   useEffect(() => {
//     const isRTL = RTL_LANGUAGES.includes(i18n.language)
//     document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr')
//     document.documentElement.setAttribute('lang', i18n.language)
//   }, [i18n.language])
// }