import sharp from "sharp";

async function main() {
  const inputPath = "public/media/alaune-classroom-backup.jpg";
  const outputPath = "public/media/alaune-classroom.jpg";
  const outputWebp = "public/media/alaune-classroom.webp";

  // Step 1: Base image: clear, warm, slightly softened micro-contrast
  const baseBuffer = await sharp(inputPath)
    .modulate({
      brightness: 1.02,
      saturation: 1.05,
    })
    .toBuffer();

  // Step 2: Smooth blurred version for the chair (depth of field foreground blur)
  const blurredChairBuffer = await sharp(inputPath)
    .modulate({
      brightness: 1.06,
      saturation: 1.02,
    })
    .blur(4.5) // refined silky cinematic blur
    .toBuffer();

  // Step 3: Precise radial/elliptical alpha mask focusing on the wheelchair in the foreground
  const maskSvg = `
    <svg width="1100" height="660" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="chairGradient" cx="54%" cy="68%" rx="38%" ry="36%" fx="54%" fy="68%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.80" />
          <stop offset="80%" stop-color="#ffffff" stop-opacity="0.30" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1100" height="660" fill="url(#chairGradient)" />
    </svg>
  `;

  const maskPng = await sharp(Buffer.from(maskSvg))
    .png()
    .toBuffer();

  // Apply mask to blurred image so only the chair gets the blur
  const maskedBlurredChair = await sharp(blurredChairBuffer)
    .ensureAlpha()
    .composite([
      {
        input: maskPng,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  // Step 4: Composite masked blur over base image
  const finalImage = sharp(baseBuffer)
    .composite([
      {
        input: maskedBlurredChair,
        blend: "over",
      },
    ]);

  await finalImage
    .clone()
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  await finalImage
    .clone()
    .webp({ quality: 92 })
    .toFile(outputWebp);

  console.log("Successfully refined smooth blurred chair image!");
}

main().catch(console.error);
