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

const HERO_PROMPT =
  'Cinematic dark hero background for a premium SaaS website, night landscape with layered mountain ridge silhouettes fading into deep black charcoal sky, soft indigo and violet glow along the horizon, faint stars, subtle mist, moody minimal atmosphere, very dark overall so white text is readable on top, professional digital matte painting, wide panoramic composition'

const CTA_PROMPT =
  'Dark abstract background of smooth flowing topographic wave lines, elegant thin glowing indigo contour lines over deep black surface, subtle violet gradient glow in the center, premium minimal SaaS aesthetic, cinematic, very dark and moody, wide composition'

const [,, which] = process.argv
const dir = '/home/z/my-project/public/images/landing'
if (which === 'hero') await gen(HERO_PROMPT, `${dir}/hero-bg.png`, '1440x704')
else if (which === 'cta') await gen(CTA_PROMPT, `${dir}/cta-bg.png`, '1440x704')
