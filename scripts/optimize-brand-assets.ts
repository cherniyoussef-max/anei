import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_DIR = path.resolve(process.cwd(), "public/brand");
const LAYERS_DIR = path.join(BRAND_DIR, "layers");
const APP_DIR = path.resolve(process.cwd(), "src/app");

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertToWebpAndAvif(filePath: string) {
  const ext = path.extname(filePath);
  if (ext.toLowerCase() !== ".png") return;

  const base = filePath.slice(0, -ext.length);
  const webpPath = `${base}.webp`;
  const avifPath = `${base}.avif`;

  console.log(`Optimizing: ${path.relative(process.cwd(), filePath)}`);

  // WebP
  await sharp(filePath)
    .webp({ quality: 90, effort: 5 })
    .toFile(webpPath);

  // AVIF
  await sharp(filePath)
    .avif({ quality: 85, effort: 5 })
    .toFile(avifPath);
}

async function createTrimmedAssets() {
  console.log("Generating trimmed bounding box assets...");

  // 1. Full logo transparent 4x -> trimmed
  const fullLogo4x = path.join(BRAND_DIR, "anei-logo-4x-transparent.png");
  if (await fileExists(fullLogo4x)) {
    const trimmedLogoImg = sharp(fullLogo4x).trim();
    const meta = await trimmedLogoImg.metadata();
    console.log(`Trimmed Full Logo dimensions: ${meta.width}x${meta.height}`);

    const trimmedPng = path.join(BRAND_DIR, "anei-logo-trimmed.png");
    const trimmedWebp = path.join(BRAND_DIR, "anei-logo-trimmed.webp");
    const trimmedAvif = path.join(BRAND_DIR, "anei-logo-trimmed.avif");

    await sharp(fullLogo4x).trim().png({ compressionLevel: 9 }).toFile(trimmedPng);
    await sharp(fullLogo4x).trim().webp({ quality: 92, effort: 5 }).toFile(trimmedWebp);
    await sharp(fullLogo4x).trim().avif({ quality: 88, effort: 5 }).toFile(trimmedAvif);

    // Also generate high-density 2x trimmed version (~800px wide) for fast standard display
    const trimmed2xWebp = path.join(BRAND_DIR, "anei-logo-trimmed-2x.webp");
    const trimmed2xPng = path.join(BRAND_DIR, "anei-logo-trimmed-2x.png");
    await sharp(trimmedPng).resize({ width: 800 }).webp({ quality: 90 }).toFile(trimmed2xWebp);
    await sharp(trimmedPng).resize({ width: 800 }).png({ compressionLevel: 9 }).toFile(trimmed2xPng);
  }

  // 2. Mark transparent 4x -> trimmed
  const mark4x = path.join(BRAND_DIR, "anei-mark-4x-transparent.png");
  if (await fileExists(mark4x)) {
    const trimmedMarkImg = sharp(mark4x).trim();
    const meta = await trimmedMarkImg.metadata();
    console.log(`Trimmed Mark dimensions: ${meta.width}x${meta.height}`);

    const trimmedMarkPng = path.join(BRAND_DIR, "anei-mark-trimmed.png");
    const trimmedMarkWebp = path.join(BRAND_DIR, "anei-mark-trimmed.webp");
    const trimmedMarkAvif = path.join(BRAND_DIR, "anei-mark-trimmed.avif");

    await sharp(mark4x).trim().png({ compressionLevel: 9 }).toFile(trimmedMarkPng);
    await sharp(mark4x).trim().webp({ quality: 92, effort: 5 }).toFile(trimmedMarkWebp);
    await sharp(mark4x).trim().avif({ quality: 88, effort: 5 }).toFile(trimmedMarkAvif);

    // Also generate compact 2x mark for header / admin mark icons (height ~140px, width ~266px)
    const trimmedMark2xWebp = path.join(BRAND_DIR, "anei-mark-trimmed-2x.webp");
    const trimmedMark2xPng = path.join(BRAND_DIR, "anei-mark-trimmed-2x.png");
    await sharp(trimmedMarkPng).resize({ height: 160 }).webp({ quality: 92 }).toFile(trimmedMark2xWebp);
    await sharp(trimmedMarkPng).resize({ height: 160 }).png({ compressionLevel: 9 }).toFile(trimmedMark2xPng);
  }
}

async function syncAppIcons() {
  console.log("Syncing app icons and favicon to Next.js metadata locations...");

  const icon32 = path.join(BRAND_DIR, "icon-32.png");
  const icon180 = path.join(BRAND_DIR, "icon-180.png");
  const favicon = path.join(BRAND_DIR, "favicon.ico");

  if (await fileExists(icon32)) {
    await fs.copyFile(icon32, path.join(APP_DIR, "icon.png"));
    console.log("✓ Copied icon-32.png -> src/app/icon.png");
  }

  if (await fileExists(icon180)) {
    await fs.copyFile(icon180, path.join(APP_DIR, "apple-icon.png"));
    console.log("✓ Copied icon-180.png -> src/app/apple-icon.png");
  }

  if (await fileExists(favicon)) {
    await fs.copyFile(favicon, path.join(APP_DIR, "favicon.ico"));
    await fs.copyFile(favicon, path.resolve(process.cwd(), "public/favicon.ico"));
    console.log("✓ Copied favicon.ico -> src/app/favicon.ico & public/favicon.ico");
  }
}

async function run() {
  console.log("Starting ANEI brand asset optimization...");

  // 1. Process root brand files
  const rootFiles = await fs.readdir(BRAND_DIR);
  for (const file of rootFiles) {
    const fullPath = path.join(BRAND_DIR, file);
    const stat = await fs.stat(fullPath);
    if (stat.isFile() && file.endsWith(".png")) {
      await convertToWebpAndAvif(fullPath);
    }
  }

async function convertLayersToWebpAndAvif(filePath: string) {
  const ext = path.extname(filePath);
  if (ext.toLowerCase() !== ".png") return;

  const base = filePath.slice(0, -ext.length);
  const webpPath = `${base}.webp`;
  const avifPath = `${base}.avif`;

  console.log(`Optimizing layer: ${path.relative(process.cwd(), filePath)}`);

  await sharp(filePath)
    .resize({ width: 1440, kernel: "lanczos3" })
    .webp({ quality: 92, effort: 5 })
    .toFile(webpPath);

  await sharp(filePath)
    .resize({ width: 1440, kernel: "lanczos3" })
    .avif({ quality: 88, effort: 5 })
    .toFile(avifPath);
}

// 2. Process layers files (optimized at 1440px for ultra-crisp Retina rendering with 10x lower memory)
  if (await fileExists(LAYERS_DIR)) {
    const layerFiles = await fs.readdir(LAYERS_DIR);
    for (const file of layerFiles) {
      const fullPath = path.join(LAYERS_DIR, file);
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && file.endsWith(".png")) {
        await convertLayersToWebpAndAvif(fullPath);
      }
    }
  }

  // 3. Create trimmed versions
  await createTrimmedAssets();

  // 4. Sync icons to Next.js app metadata
  await syncAppIcons();

  console.log("Brand asset optimization completed successfully!");
}

run().catch((err) => {
  console.error("Optimization failed:", err);
  process.exit(1);
});
