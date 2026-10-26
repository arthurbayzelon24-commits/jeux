// Renders assets/powers/*.jpg, assets/header.jpg and the app icons from
// tools/art.js. Needs Playwright and the local server: node magic-cam/serve.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${process.env.PORT || 8080}/tools/art.html`);
  await page.waitForFunction(() => window.renderAll);
  const art = await page.evaluate(() => window.renderAll());
  const save = (file, dataUrl) => fs.writeFileSync(path.join(root, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  for (const [id, url] of Object.entries(art.powers)) save(`assets/powers/${id}.jpg`, url);
  save('assets/header.jpg', art.header);
  save('assets/icon2-1024.png', art.icon);
  // Smaller icon sizes, resized by the browser.
  for (const s of [512, 192, 180, 64]) {
    const url = await page.evaluate(
      ([src, s]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = c.height = s;
            const g = c.getContext('2d');
            g.imageSmoothingQuality = 'high';
            g.drawImage(img, 0, 0, s, s);
            resolve(c.toDataURL('image/png'));
          };
          img.src = src;
        }),
      [art.icon, s],
    );
    save(`assets/icon2-${s}.png`, url);
  }
  console.log(`${Object.keys(art.powers).length} cartes, bannière et icônes générées.`);
  await browser.close();
})();
