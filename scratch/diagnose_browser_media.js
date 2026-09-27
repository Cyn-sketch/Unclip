const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

async function runMediaDiagnostics() {
  const testUrl = process.argv[2] || 'https://www.instagram.com/reel/C5x5p5nO5wH/';
  console.log(`\n=== 1. MEDIA RESPONSE DIAGNOSTICS ===`);
  console.log(`Target Reel URL: ${testUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  const candidateResponses = [];

  page.on('response', async (response) => {
    try {
      const fullUrlStr = response.url();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      const contentLength = headers['content-length'] || 'N/A';
      const contentRange = headers['content-range'] || 'N/A';
      const status = response.status();
      const request = response.request();
      const resourceType = request.resourceType();

      const parsedUrl = new URL(fullUrlStr);
      const hostname = parsedUrl.hostname;
      const pathname = parsedUrl.pathname;

      const isVideo =
        pathname.endsWith('.mp4') ||
        pathname.includes('/bytestream/') ||
        contentType.includes('video/') ||
        contentType.includes('application/x-mpegURL') ||
        resourceType === 'media';

      if (isVideo) {
        const bodyBuf = await response.body().catch(() => null);
        const bodyLength = bodyBuf ? bodyBuf.length : 0;

        const info = {
          index: candidateResponses.length + 1,
          status,
          contentType,
          contentLength,
          contentRange,
          resourceType,
          hostname,
          pathname,
          bodyLength,
          fullUrl: fullUrlStr,
          bodyBuf,
        };
        candidateResponses.push(info);

        console.log(`\nCandidate Response #${info.index}:`);
        console.log(`  status: ${status}`);
        console.log(`  contentType: ${contentType}`);
        console.log(`  contentLength: ${contentLength}`);
        console.log(`  contentRange: ${contentRange}`);
        console.log(`  resourceType: ${resourceType}`);
        console.log(`  hostname: ${hostname}`);
        console.log(`  pathname: ${pathname}`);
        console.log(`  capturedBytes: ${bodyLength}`);
      }
    } catch (e) {
      // ignore
    }
  });

  console.log(`Navigating browser to ${testUrl}...`);
  const gotoRes = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
  console.log(`Page DOM loaded. HTTP Status: ${gotoRes ? gotoRes.status() : 'N/A'}`);

  // Wait 5 seconds for client JS rendering
  await page.waitForTimeout(5000);

  // Extract embedded video URLs from page HTML/scripts/state
  const extractedUrls = await page.evaluate(() => {
    const urls = [];
    const html = document.documentElement.innerHTML;

    // Search for video_url or video_versions in scripts/HTML
    const matches = html.matchAll(/"video_url"\s*:\s*"([^"]+)"/gi);
    for (const m of matches) {
      if (m[1]) urls.push(m[1].replace(/\\u0026/g, '&').replace(/\\/g, ''));
    }

    const versionMatches = html.matchAll(/"url"\s*:\s*"(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/gi);
    for (const m of versionMatches) {
      if (m[1]) urls.push(m[1].replace(/\\u0026/g, '&').replace(/\\/g, ''));
    }

    // Check video tag
    const v = document.querySelector('video');
    if (v && v.src && v.src.startsWith('http')) {
      urls.push(v.src);
    }

    return Array.from(new Set(urls));
  }).catch(() => []);

  console.log(`\nExtracted MP4 URLs from page state: ${extractedUrls.length}`);
  extractedUrls.forEach((u, i) => {
    try {
      const p = new URL(u);
      console.log(`  Url #${i + 1}: hostname=${p.hostname}, path=${p.pathname}`);
    } catch (e) {
      console.log(`  Url #${i + 1}: invalid URL format`);
    }
  });

  console.log(`\n=== 2. DIAGNOSTIC SUMMARY ===`);
  console.log(`Total intercepted media responses: ${candidateResponses.length}`);
  candidateResponses.forEach((r) => {
    console.log(`Resp #${r.index} | Status: ${r.status} | Content-Type: ${r.contentType} | Content-Range: ${r.contentRange} | Length: ${r.contentLength} | Captured: ${r.bodyLength}B`);
  });

  let targetVideoBuffer = null;
  let captureMethod = 'NONE';

  // Strategy A: If page state exposed a full MP4 URL, fetch it using page.request inside the browser context
  if (extractedUrls.length > 0) {
    for (const fullMp4Url of extractedUrls) {
      console.log(`\nAttempting browser page.request.get() on extracted MP4 URL...`);
      try {
        const fetchRes = await page.request.get(fullMp4Url);
        console.log(`  Fetch Status: ${fetchRes.status()}`);
        console.log(`  Content-Type: ${fetchRes.headers()['content-type']}`);
        console.log(`  Content-Length: ${fetchRes.headers()['content-length']}`);
        console.log(`  Content-Range: ${fetchRes.headers()['content-range'] || 'NONE'}`);

        if (fetchRes.ok()) {
          const buf = await fetchRes.body();
          if (buf.length > 50000) {
            targetVideoBuffer = buf;
            captureMethod = 'BROWSER_PAGE_REQUEST_FULL_MP4';
            break;
          }
        }
      } catch (e) {
        console.log(`  Fetch error: ${e.message}`);
      }
    }
  }

  // Strategy B: If no extracted URL, check intercepted responses
  if (!targetVideoBuffer && candidateResponses.length > 0) {
    // Check if any response is 200 OK with full MP4
    const res200 = candidateResponses.find(r => r.status === 200 && r.bodyLength > 100000);
    if (res200) {
      targetVideoBuffer = res200.bodyBuf;
      captureMethod = `INTERCEPTED_RESPONSE_STATUS_200_${res200.index}`;
    } else {
      // Attempt full page.request download of first candidate response URL without Range header
      const firstCand = candidateResponses[0];
      console.log(`\nAttempting browser page.request.get() on candidate response #${firstCand.index} URL...`);
      try {
        const fetchRes = await page.request.get(firstCand.fullUrl);
        console.log(`  Fetch Status: ${fetchRes.status()}`);
        console.log(`  Content-Length: ${fetchRes.headers()['content-length']}`);
        if (fetchRes.ok()) {
          const buf = await fetchRes.body();
          targetVideoBuffer = buf;
          captureMethod = `INTERCEPTED_URL_FULL_FETCH_${firstCand.index}`;
        }
      } catch (e) {
        console.log(`  Fetch error: ${e.message}`);
      }
    }
  }

  console.log(`\n=== 3. CAPTURED FILE VALIDATION (BEFORE FFMPEG) ===`);
  if (targetVideoBuffer) {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, 'unclip_diag_captured_video.mp4');
    fs.writeFileSync(testFile, targetVideoBuffer);

    const fileSize = fs.statSync(testFile).size;
    const headerHex = targetVideoBuffer.slice(0, 16).toString('hex');
    const headerAscii = targetVideoBuffer.slice(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    const hasFtyp = targetVideoBuffer.slice(0, 64).includes(Buffer.from('ftyp'));

    console.log(`Capture Method: ${captureMethod}`);
    console.log(`File exists: true`);
    console.log(`File size: ${fileSize} bytes`);
    console.log(`Header Hex: ${headerHex}`);
    console.log(`Header ASCII: ${headerAscii}`);
    console.log(`Has 'ftyp' MP4 signature: ${hasFtyp}`);

    let ffprobeResult = null;
    try {
      const probeJson = execSync(`ffprobe -v error -show_entries format=format_name,duration,size -show_entries stream=codec_type,codec_name,width,height -of json "${testFile}"`).toString();
      ffprobeResult = JSON.parse(probeJson);
      console.log(`\nffprobe output:`);
      console.log(JSON.stringify(ffprobeResult, null, 2));
    } catch (err) {
      console.log(`\nffprobe failed to parse file: ${err.message}`);
    }

    fs.unlinkSync(testFile);
  } else {
    console.log(`No valid video buffer could be obtained.`);
  }

  await context.close();
  await browser.close();
}

runMediaDiagnostics().catch((err) => {
  console.error('[Diagnostic Error]', err);
  process.exit(1);
});
