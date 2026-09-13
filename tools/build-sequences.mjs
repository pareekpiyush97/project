/**
 * build-sequences.mjs — turns the raw ezGif frame dumps into the WebP scroll
 * sequences the desktop site scrubs, plus a manifest the front-end reads.
 *
 *   node tools/build-sequences.mjs
 *
 * Source frames stay untouched in Downloads/mywebpage/ezGif. Output:
 *   assets/seq/<name>/<width>/f0001.webp
 *   assets/seq/manifest.json  +  js/seq-manifest.js
 *
 * Desktop-only site: phones get mobile.html, which has no canvas sequences at
 * all, so both tiers here are sized for a real monitor — 1920 for the machine
 * in front of you, 1200 for one on a metered or starved connection.
 *
 * The tier WIDTHS are a ceiling, not a target: withoutEnlargement means a clip
 * whose source is smaller keeps its own pixels and simply lives in the 1920
 * folder — hero and services are both 1280x720 that way. Upscaling would cost
 * bytes and fill rate and buy no detail.
 *
 * A clip can come from a video: extract it losslessly first, e.g.
 *   ffmpeg -i clip.mp4 -fps_mode passthrough <SRC>/<folder>/f%04d.png
 *
 * hero-reveal is generated footage and carried a Gemini sparkle at
 * x 1137-1183, y 577-623 of its 1280x720 frames. It is painted out at
 * EXTRACTION time, so re-extracting without this filter brings it back:
 *   ffmpeg -i _source.mp4 -vf "delogo=x=1131:y=571:w=59:h=59" \
 *          -fps_mode passthrough <SRC>/hero-reveal/f%04d.png
 * Verified after: no pixel over luma 90 in that corner, and the patched box
 * sits within ~2.7 levels of its neighbours.
 *
 * Frame COUNT is what buys smooth scrubbing, and it is cheap next to width:
 * measured on these dark showroom frames, 1920/q68 lands at ~83KB, barely
 * above the old 1600/q62 (~68KB). So the budget goes into density.
 */
import sharp from 'sharp';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'C:/Users/DELL/Downloads/mywebpage/ezGif';
const OUT = path.resolve('assets/seq');

/* Two tiers, and the small one is NOT for phones — they get mobile.html, which
   has no sequences at all. It is what sequence.js falls back to on data-saver,
   2G or a ~2GB machine, so it trades frames for bytes rather than detail. */
const TIERS = [
  { w: 1920, q: 68, effort: 6, share: 1 },      // full density
  { w: 1200, q: 64, effort: 6, share: 0.5 },    // thrifty: half the frames
];
const JOBS = 6;          // parallel sharp pipelines; 120 at once spikes RAM

/** role -> [source folder, frame cap]. Each clip gets exactly one job.
 *  Caps: scrubbed sections get density; `menu` only plays a 2.2s intro, and
 *  `booking` has just 46 source frames so it takes all of them. */
const CLIPS = {
  hero:     ['hero-reveal',     240],  // sports car reveal — every frame of the 24fps clip
  // craft: the manifesto chapter plays assets/videos/craft.mp4 outright instead
  // of scrubbing frames, so its sequence is no longer built or shipped
  // services shares the hero's source on purpose — same reveal, scrubbed again
  // behind The Menu. Its frames are already de-watermarked by the hero build.
  services: ['hero-reveal',     240],
  process:  ['ezip - Copy (7)', 120],  // workshop, lifts + robots
  proof:    ['ezip - Copy (4)', 120],  // BODYSHOP, silver + lime (work.html)
  booking:  ['ezip - Copy (6)',  46],  // grey hypercar, chrome showroom
  menu:     ['ezip - Copy',      72],  // chameleon Porsche, menu backdrop
  work:     ['ezip - Copy (2)', 120],  // purple + green, bright white studio
};

/** Evenly sample `n` items from a list, always keeping first and last. */
function sample(list, n) {
  if (list.length <= n) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return out;
}

/** Run `fn` over `items` at most `limit` at a time. */
async function pool(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  });
  await Promise.all(workers);
}

/* `node tools/build-sequences.mjs hero craft` rebuilds just those; no args = all.
   Rebuilding all eight is ~7 minutes, which is a silly price for one clip.
   A partial run has to START from the manifest on disk, or it would publish a
   manifest listing only the clips it rebuilt and the other seven would 404. */
const only = process.argv.slice(2);
let manifest = {};
if (only.length) {
  try {
    manifest = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
  } catch { console.warn('! no existing manifest to merge into — building all'); }
}
let totalBytes = 0;

for (const [name, [folder, cap]] of Object.entries(CLIPS)) {
  if (only.length && !only.includes(name)) continue;
  const dir = path.join(SRC, folder);
  // PNG too: a clip extracted with ffmpeg comes out lossless, so the WebP below
  // is the only generation of loss the frames ever take
  const files = (await readdir(dir)).filter(f => /\.(jpe?g|png)$/i.test(f)).sort();
  if (!files.length) { console.warn(`! ${name}: no frames in ${folder}`); continue; }

  await rm(path.join(OUT, name), { recursive: true, force: true });  // drops the old 900/1600 tiers
  const sizes = {};

  for (const tier of TIERS) {
    const picks = sample(files, Math.round(cap * tier.share));
    const destDir = path.join(OUT, name, String(tier.w));
    await mkdir(destDir, { recursive: true });

    let bytes = 0, w = 0, h = 0;
    await pool(picks, JOBS, async (file, i) => {
      const dest = path.join(destDir, `f${String(i + 1).padStart(4, '0')}.webp`);
      const info = await sharp(path.join(dir, file))
        .resize({ width: tier.w, withoutEnlargement: true })
        .webp({ quality: tier.q, effort: tier.effort })
        .toFile(dest);
      bytes += info.size; w = info.width; h = info.height;
    });

    totalBytes += bytes;
    sizes[tier.w] = picks.length;
    console.log(`  ${name}/${tier.w}  ${picks.length} frames  ${w}x${h}  ${(bytes / 1048576).toFixed(2)} MB`);
  }

  manifest[name] = { ext: 'webp', sizes };
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Also emit as a plain script: no fetch round-trip before the first frame can
// start loading, and the site still works when opened straight from disk.
await writeFile(
  path.resolve('js/seq-manifest.js'),
  `/* generated by tools/build-sequences.mjs — do not edit */\n` +
  `window.ZLAB_SEQ = ${JSON.stringify(manifest, null, 2)};\n` +
  `window.APEX_SEQ = window.ZLAB_SEQ;\n`   // alias for older cached scripts
);
console.log(`\nmanifest written · total ${(totalBytes / 1048576).toFixed(1)} MB`);
