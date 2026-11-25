/**
 * Zmenší 12 fotek CategoryStrip na 640px WebP + JPEG.
 * Spouštět při změně CATEGORY_PHOTO_ID: node scripts/generate-category-strip-images.mjs
 */
import { mkdirSync, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ids = [10389335, 4953465, 354628, 2872112, 4407744, 3746476, 6109976, 6896277, 5932654, 756490, 1850011, 1786327]
const outDir = path.join(root, 'public/food-illustrations/pixabay/category')
mkdirSync(outDir, { recursive: true })

for (const id of ids) {
  const src = path.join(root, 'public/food-illustrations/pixabay', `${id}.jpg`)
  if (!existsSync(src)) {
    console.error('missing', src)
    process.exitCode = 1
    continue
  }
  const webp = path.join(outDir, `${id}-640.webp`)
  const jpg = path.join(outDir, `${id}-640.jpg`)
  await sharp(src).resize(640, null, { withoutEnlargement: true }).webp({ quality: 72 }).toFile(webp)
  await sharp(src).resize(640, null, { withoutEnlargement: true }).jpeg({ quality: 74, mozjpeg: true }).toFile(jpg)
  const [w, j] = await Promise.all([stat(webp), stat(jpg)])
  console.info(id, Math.round(w.size / 1024) + 'k webp', Math.round(j.size / 1024) + 'k jpg')
}
