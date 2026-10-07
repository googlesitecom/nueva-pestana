/** Genera icon.png (512) y apple-icon.png (180) desde el emblema del logo */
import sharp from "sharp";
import { join } from "path";

const pub = join(process.cwd(), "public");

async function main() {
  await sharp(join(pub, "logo-emblem.png"))
    .resize(512, 512, { fit: "cover" })
    .png({ quality: 90 })
    .toFile(join(pub, "icon.png"));

  await sharp(join(pub, "logo-emblem.png"))
    .resize(180, 180, { fit: "cover" })
    .png({ quality: 90 })
    .toFile(join(pub, "apple-icon.png"));

  console.log("OK: public/icon.png (512) y public/apple-icon.png (180)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
