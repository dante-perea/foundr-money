#!/usr/bin/env node
/**
 * Screenshot helper for visual verification.
 *
 * Usage: node scripts/snap.mjs <url> <output-path>
 * Example: node scripts/snap.mjs http://localhost:3000/ /tmp/landing.png
 *
 * Prints canvas dimensions and ALL console errors, page errors, and failed
 * network requests so the agent can diagnose without re-running.
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'

const [, , url, outputPath] = process.argv

if (!url || !outputPath) {
  console.error('Usage: node scripts/snap.mjs <url> <output-path>')
  process.exit(1)
}

await mkdir(dirname(outputPath), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const consoleErrors = []
const pageErrors = []
const failedRequests = []

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`))

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.screenshot({ path: outputPath, fullPage: true })

const dims = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
}))

console.log(JSON.stringify({ dims, consoleErrors, pageErrors, failedRequests }, null, 2))
await browser.close()
