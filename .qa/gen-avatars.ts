import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'

async function gen(prompt: string, outputPath: string, size: string) {
  const zai = await ZAI.create()
  const response = await zai.images.generations.create({ prompt, size })
  const base64 = response.data[0].base64
  if (!base64) throw new Error('No image data returned')
  fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'))
  console.log(`saved ${outputPath} (${size})`)
}

const dir = '/home/z/my-project/public/images/landing'

// Editorial author headshots for the blog bylines — warm, consistent studio look.
const AVATARS = [
  {
    file: 'author-1.png',
    prompt:
      'Professional corporate headshot portrait of a confident East Asian woman in her early 30s, short black hair, wearing a charcoal blazer, warm friendly expression, soft natural window light, warm cream studio background, editorial magazine photography style, sharp focus on face, square composition, head and shoulders',
  },
  {
    file: 'author-2.png',
    prompt:
      'Professional corporate headshot portrait of a friendly Latino man in his late 30s, short dark beard, wearing a heather-grey crewneck sweater over a collared shirt, warm confident smile, soft natural window light, warm cream studio background, editorial magazine photography style, sharp focus on face, square composition, head and shoulders',
  },
  {
    file: 'author-3.png',
    prompt:
      'Professional corporate headshot portrait of a poised South Asian woman in her early 30s, long dark hair, wearing a rust-orange blouse, gentle assured smile, soft natural window light, warm cream studio background, editorial magazine photography style, sharp focus on face, square composition, head and shoulders',
  },
]

for (const a of AVATARS) {
  try {
    await gen(a.prompt, `${dir}/${a.file}`, '1024x1024')
  } catch (err) {
    console.error(`FAILED ${a.file}:`, err instanceof Error ? err.message : err)
  }
}
console.log('avatar generation complete')
