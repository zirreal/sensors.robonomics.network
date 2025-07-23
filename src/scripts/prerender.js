const { createServer } = require('vite');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const routes = [
  'privacy-policy',
  'air-measurements',
  'altruist-timeline',
  'altruist-use-cases'
];

const outputDir = path.resolve(__dirname, '../../dist');

async function prerender() {
  const server = await createServer({
    configFile: path.resolve(__dirname, '../../vite.config.js'),
    preview: {
      port: 4173,
      strictPort: true
    }
  });

  await server.listen();
  console.log('Vite preview server started on http://localhost:4173');

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  for (const route of routes) {
    const hashRoute = route ? `/#/${route}/` : '/#/';
    const url = `http://localhost:4173${hashRoute}`;

    console.log(`Prerendering ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for #app element to appear on the page before getting content
    await page.waitForSelector('#app', { timeout: 10000 });

    let html = await page.content();

    const outPath = path.join(outputDir, route, 'index.html');
    
    // Fix css path
    html = html
      .replace(/(<link[^>]+href=")\.\/assets\//g, '$1../assets/')
        
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);

    console.log(`✅ Saved prerendered page: ${outPath}`);
  }

  await browser.close();
  await server.close();
  console.log('Prerendering completed and preview server stopped.');
}

prerender().catch(err => {
  console.error(err);
  process.exit(1);
});
