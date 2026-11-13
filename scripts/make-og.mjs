// Renders the link-preview image (src/app/opengraph-image.png): the official white lockup
// centred on the brand navy, 1200×630 as Telegram, Facebook and X expect.
// Run: node scripts/make-og.mjs   (re-run after changing the lockup)
import path from "node:path";
import sharp from "sharp";

const W = 1200, H = 630;
const logo = await sharp(path.resolve("public/brand/logo-white.webp")).resize({ width: 760 }).toBuffer();

await sharp({ create: { width: W, height: H, channels: 4, background: "#010d58" } })
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile(path.resolve("src/app/opengraph-image.png"));

console.log("wrote src/app/opengraph-image.png");
