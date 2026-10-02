import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { getAneiLogoConfig } from "@/lib/brand";

test("AneiLogo: asset files exist in public/brand and metadata locations", async () => {
  const brandDir = path.resolve(process.cwd(), "public/brand");
  const requiredBrandFiles = [
    "anei-logo-trimmed.png",
    "anei-logo-trimmed.webp",
    "anei-mark-trimmed.png",
    "anei-mark-trimmed.webp",
    "anei-logo-4x-transparent.png",
    "anei-logo-4x-transparent.webp",
    "anei-logo-4x-on-white.png",
    "anei-logo-4x-on-white.webp",
    "icon-32.png",
    "icon-180.png",
    "icon-192.png",
    "icon-512.png",
    "favicon.ico",
  ];

  for (const file of requiredBrandFiles) {
    const stat = await fs.stat(path.join(brandDir, file));
    assert.ok(stat.size > 0, `File ${file} must exist and not be empty`);
  }

  // App metadata assets
  const appDir = path.resolve(process.cwd(), "src/app");
  const requiredAppFiles = [
    "icon.png",
    "apple-icon.png",
    "favicon.ico",
    "opengraph-image.png",
    "manifest.ts",
  ];

  for (const file of requiredAppFiles) {
    const stat = await fs.stat(path.join(appDir, file));
    assert.ok(stat.size > 0, `App metadata file ${file} must exist and not be empty`);
  }
});

test("AneiLogo: layers exist in public/brand/layers for animated hero", async () => {
  const layersDir = path.resolve(process.cwd(), "public/brand/layers");
  const requiredLayers = [
    "layer-navy.png",
    "layer-navy.webp",
    "layer-gold.png",
    "layer-gold.webp",
    "layer-shadow.png",
    "layer-shadow.webp",
    "layer-arabic.png",
    "layer-arabic.webp",
    "layer-french.png",
    "layer-french.webp",
  ];

  for (const file of requiredLayers) {
    const stat = await fs.stat(path.join(layersDir, file));
    assert.ok(stat.size > 0, `Layer ${file} must exist and not be empty`);
  }
});

test("AneiLogo: enforces >= 72px height rule for full logo", () => {
  // At height >= 72, variant full renders the full logo image
  const fullConfig = getAneiLogoConfig("fr", "full", 74);
  assert.equal(fullConfig.effectiveVariant, "full");
  assert.equal(fullConfig.src, "/brand/anei-logo-trimmed-2x.webp");
  assert.equal(fullConfig.targetHeight, 74);
  assert.equal(fullConfig.calculatedWidth, Math.round(74 * (3619 / 1772)));
  assert.equal(fullConfig.altText, "Académie Nationale de l’Éducation Inclusive");
  assert.equal(fullConfig.shouldRenderText, false);
  assert.equal(fullConfig.isEnforcedMark, false);

  // At height < 72, variant full is automatically demoted to mark + real text
  const demotedConfig = getAneiLogoConfig("fr", "full", 40);
  assert.equal(demotedConfig.effectiveVariant, "mark");
  assert.equal(demotedConfig.src, "/brand/anei-mark-trimmed-2x.webp");
  assert.equal(demotedConfig.targetHeight, 40);
  assert.equal(demotedConfig.calculatedWidth, Math.round(40 * (2120 / 1117)));
  assert.equal(demotedConfig.shouldRenderText, true);
  assert.equal(demotedConfig.isEnforcedMark, true);

  // Arabic locale provides Arabic alt text and academy name
  const arConfig = getAneiLogoConfig("ar", "mark", 36, true);
  assert.equal(arConfig.effectiveVariant, "mark");
  assert.equal(arConfig.altText, "الأكاديمية الوطنية للتربية الدامجة");
  assert.equal(arConfig.academyName, "الأكاديمية الوطنية للتربية الدامجة");
  assert.equal(arConfig.shouldRenderText, true);
});
