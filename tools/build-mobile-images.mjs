/**
 * build-mobile-images.mjs — WebP copies of assets/img for the phone build.
 *
 *   npm run build:img
 *
 * The mobile page shows ~19 photographs. The source JPEGs total ~2MB, which is
 * real money on a metered 4G connection, and no phone needs a 1600px source for
 * a card that is at most 560 CSS px wide. One 900px WebP tier covers a dpr-2.4
 * handset at full bleed; the desktop build keeps using the original JPEGs.
 */
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('assets/img');
const OUT = path.join(SRC, 'm');

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter(f => /\.jpe?g$/i.test(f));

let before = 0, after = 0;
for (const file of files) {
  const dest = path.join(OUT, file.replace(/\.jpe?g$/i, '.webp'));
  const info = await sharp(path.join(SRC, file))
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 72, effort: 6 })
    .toFile(dest);
  before += statSync(path.join(SRC, file)).size;
  after += info.size;
  console.log(`  ${file} -> m/${path.basename(dest)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}
/* The wordmark is a 1200px transparent PNG and the app bar draws it 22px tall:
   44KB on the critical path for nothing. */
const mark = await sharp(path.resolve('assets/brand/logo.png'))
  .resize({ width: 320 })
  .webp({ quality: 88, effort: 6, alphaQuality: 90 })
  .toFile(path.resolve('assets/brand/logo-sm.webp'));
console.log(`  logo.png -> brand/logo-sm.webp  ${mark.width}x${mark.height}  ${(mark.size / 1024).toFixed(1)}KB`);

console.log(`\n${files.length} images · ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB` +
            ` (${Math.round((1 - after / before) * 100)}% smaller)`);
await writeFile(path.join(OUT, '.gitkeep'), '');
