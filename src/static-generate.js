import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const routes = [
  'privacy-policy',
  'air-measurements',
  'altruist-timeline',
  'altruist-use-cases',
  'altruist-compare'
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../dist');

function waitForPort(port, host = 'localhost', timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const socket = net.createConnection(port, host);

      socket.on('connect', () => {
        socket.end();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };

    check();
  });
}

async function prerender() {
  console.log('🚀 Starting vite preview server...');

  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const cleanup = () => previewProcess.kill();
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(1);
  });

  await waitForPort(4173);
  console.log('✅ Vite preview server is running at http://localhost:4173');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  for (const route of routes) {
    const hashRoute = route ? `/#/${route}/` : '/#/';
    const url = `http://localhost:4173${hashRoute}`;

    console.log(`🌐 Prerendering ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#app', { timeout: 10000 });

    let html = await page.content();

    html = html.replace(
      /(<link[^>]+href="|<script[^>]+src=")(\.*\/)*assets\//g,
      '$1/assets/'
    );

    const REDIRECT_JS = `
    <script>
    if (!location.hash && location.pathname.match(/^\\/(altruist-use-cases|privacy-policy|air-measurements|altruist-timeline|altruist-compare)\\/?$/)) {
        var path = location.pathname.replace(/^\\//, '').replace(/\\/$/, '');
        location.replace('/#/' + path + location.search + location.hash);
    }
    </script>
    `;

    html = html.replace('<head>', `<head>${REDIRECT_JS}`);

    const outPath = path.join(outputDir, route, 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);

    console.log(`✅ Saved prerendered page: ${outPath}`);
  }

  await browser.close();

  previewProcess.kill();
  console.log('🎉 Prerendering completed and preview server stopped.');
}

prerender().catch((err) => {
  console.error('❌ Prerendering failed:', err);
  process.exit(1);
});
