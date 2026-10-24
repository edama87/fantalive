// Genera tutte le icone da assets/logo-source.jpg (logo di Daniele, badge rotondo su bianco).
// Per cambiare logo: sostituisci quel file (e, se serve, CROP qui sotto) e lancia
//   node scripts/generate-icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SRC = new URL('../assets/logo-source.jpg', import.meta.url).pathname;
const OUT = (name) => new URL(`../public/${name}`, import.meta.url).pathname;
// Quadrato attorno al badge (cerchio + scritta BUNDLESLIGA), in pixel del sorgente 1024x765.
const CROP = { left: 135, top: 7, width: 752, height: 752 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const square = await sharp(SRC).extract(CROP).png().toBuffer();

/** Logo ridimensionato a `size`, con `pad` (frazione) di margine bianco per lato. */
async function icon(size, pad) {
  const inner = Math.round(size * (1 - 2 * pad));
  const logo = await sharp(square).resize(inner, inner, { kernel: 'lanczos3' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: WHITE })
    .png({ palette: true, quality: 92, compressionLevel: 9 });
}

await (await icon(192, 0.03)).toFile(OUT('icons/icon-192.png'));
await (await icon(512, 0.03)).toFile(OUT('icons/icon-512.png'));
// Maskable: il contenuto deve stare nel cerchio centrale dell'80% (safe zone).
await (await icon(192, 0.1)).toFile(OUT('icons/icon-maskable-192.png'));
await (await icon(512, 0.1)).toFile(OUT('icons/icon-maskable-512.png'));
// iOS arrotonda da sé gli angoli: sfondo bianco pieno, un po' di margine.
await (await icon(180, 0.06)).toFile(OUT('icons/apple-touch-icon.png'));
// L'ICO vuole PNG RGBA veri (niente palette), altrimenti Next non lo decodifica.
const rgba = async (size) => sharp(await (await icon(size, 0)).toBuffer()).ensureAlpha().png({ palette: false }).toBuffer();
const fav32 = await rgba(32);
const fav16 = await rgba(16);
await writeFile(OUT('icons/favicon-32.png'), fav32);
await writeFile(OUT('icons/favicon-16.png'), fav16);

// favicon.ico con PNG 16 e 32 incorporati.
const images = [fav16, fav32];
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const size = i === 0 ? 16 : 32;
  const e = 6 + 16 * i;
  header.writeUInt8(size, e); header.writeUInt8(size, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
await writeFile(OUT('../src/app/favicon.ico'), Buffer.concat([header, ...images]));
console.log('icone generate');
