import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "public", "icons");
const source = path.join(root, "source.svg");

const out = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-192-maskable.png", size: 192, pad: 20 },
  { file: "icon-512-maskable.png", size: 512, pad: 52 },
];

const svg = await fs.readFile(source);

for (const { file, size, pad } of out) {
  const target = path.join(root, file);
  if (pad === 0) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(target);
  } else {
    // Maskable icons need padding inside a colored background.
    const inner = await sharp(svg, { density: 300 })
      .resize(size - pad * 2, size - pad * 2)
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 23, g: 23, b: 23, alpha: 1 },
      },
    })
      .composite([{ input: inner, top: pad, left: pad }])
      .png({ compressionLevel: 9 })
      .toFile(target);
  }
  console.log(`✓ ${file}`);
}

console.log("Done.");