import fs from 'fs'
import path from 'path'

const SOURCE_FILE = './src/locales/en.json'
const OUTPUT_DIR = './src/locales'
const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3.1'

const targetLanguages = {
  ar: 'Arabic',
  hi: 'Hindi',
  fr: 'French',
}

const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'))

async function translateText(text, targetLangName) {
  const prompt = `Translate the following UI text to ${targetLangName}. Return ONLY the translated text, no explanation, no quotes, no extra formatting:\n\n${text}`

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  })

  const data = await res.json()
  let result = data.response.trim()

  // Strip Qwen3's <think>...</think> reasoning block if present
  result = result.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // Also strip stray quotes the model sometimes adds
  result = result.replace(/^["']|["']$/g, '').trim()

  return result
}

async function translateObject(obj, targetLangName) {
  const result = {}
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      result[key] = await translateObject(obj[key], targetLangName)
    } else {
      result[key] = await translateText(obj[key], targetLangName)
      console.log(`  ${key}: "${obj[key]}" → "${result[key]}"`)
    }
  }
  return result
}

async function run() {
  for (const [langCode, langName] of Object.entries(targetLanguages)) {
    console.log(`\nTranslating to ${langName} (${langCode})...`)
    const translated = await translateObject(sourceData, langName)
    const outputPath = path.join(OUTPUT_DIR, `${langCode}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(translated, null, 2))
    console.log(`Saved: ${outputPath}`)
  }
}

run()


// run everytime when en.json change : node scripts/translate.mjs