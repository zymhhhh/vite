// test utils used in e2e tests for playgrounds.
// `import { getColor } from '../../testUtils'`

import fs from 'fs'
import path from 'path'
import colors from 'css-color-names'
import type { ElementHandle } from 'playwright-chromium'
import type { Manifest } from 'vite'
import { normalizePath } from 'vite'
import { fromComment } from 'convert-source-map'
import { expect } from 'vitest'

// make sure these ports are unique
export const ports = {
  cli: 9510,
  'cli-module': 9511,
  'legacy/ssr': 9520,
  lib: 9521,
  'optimize-missing-deps': 9522,
  'ssr-deps': 9600,
  'ssr-html': 9601,
  'ssr-pug': 9602,
  'ssr-react': 9603,
  'ssr-vue': 9604,
  'ssr-webworker': 9605,
  'css/postcss-caching': 5005,
  'css/postcss-plugins-different-dir': 5006
}

export function slash(p: string): string {
  return p.replace(/\\/g, '/')
}

export const isBuild = !!process.env.VITE_TEST_BUILD
export const isServe = !isBuild

export const testDir = () => {
  const testPath = expect.getState().testPath
  const testName = slash(testPath).match(/playground\/([\w-]+)\//)?.[1]
  return path.resolve(__dirname, '../playground-temp', testName)
}
export const workspaceRoot = path.resolve(__dirname, '../')

const hexToNameMap: Record<string, string> = {}
Object.keys(colors).forEach((color) => {
  hexToNameMap[colors[color]] = color
})

function componentToHex(c: number): string {
  const hex = c.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const [_, rs, gs, bs] = match
    return (
      '#' +
      componentToHex(parseInt(rs, 10)) +
      componentToHex(parseInt(gs, 10)) +
      componentToHex(parseInt(bs, 10))
    )
  } else {
    return '#000000'
  }
}

const timeout = (n: number) => new Promise((r) => setTimeout(r, n))

async function toEl(el: string | ElementHandle): Promise<ElementHandle> {
  if (typeof el === 'string') {
    return await page.$(el)
  }
  return el
}

export async function getColor(el: string | ElementHandle): Promise<string> {
  el = await toEl(el)
  const rgb = await el.evaluate((el) => getComputedStyle(el as Element).color)
  return hexToNameMap[rgbToHex(rgb)] ?? rgb
}

export async function getBg(el: string | ElementHandle): Promise<string> {
  el = await toEl(el)
  return el.evaluate((el) => getComputedStyle(el as Element).backgroundImage)
}

export async function getBgColor(el: string | ElementHandle): Promise<string> {
  el = await toEl(el)
  return el.evaluate((el) => getComputedStyle(el as Element).backgroundColor)
}

export function readFile(filename: string): string {
  return fs.readFileSync(path.resolve(testDir(), filename), 'utf-8')
}

export function editFile(
  filename: string,
  replacer: (str: string) => string,
  runInBuild: boolean = false
): void {
  if (isBuild && !runInBuild) return
  filename = path.resolve(testDir(), filename)
  const content = fs.readFileSync(filename, 'utf-8')
  const modified = replacer(content)
  fs.writeFileSync(filename, modified)
}

export function addFile(filename: string, content: string): void {
  fs.writeFileSync(path.resolve(testDir(), filename), content)
}

export function removeFile(filename: string): void {
  fs.unlinkSync(path.resolve(testDir(), filename))
}

export function listAssets(base = ''): string[] {
  const assetsDir = path.join(testDir(), 'dist', base, 'assets')
  return fs.readdirSync(assetsDir)
}

export function findAssetFile(match: string | RegExp, base = ''): string {
  const assetsDir = path.join(testDir(), 'dist', base, 'assets')
  const files = fs.readdirSync(assetsDir)
  const file = files.find((file) => {
    return file.match(match)
  })
  return file ? fs.readFileSync(path.resolve(assetsDir, file), 'utf-8') : ''
}

export function readManifest(base = ''): Manifest {
  return JSON.parse(
    fs.readFileSync(
      path.join(testDir(), 'dist', base, 'manifest.json'),
      'utf-8'
    )
  )
}

/**
 * Poll a getter until the value it returns includes the expected value.
 */
export async function untilUpdated(
  poll: () => string | Promise<string>,
  expected: string,
  runInBuild = false
): Promise<void> {
  if (isBuild && !runInBuild) return
  const maxTries = process.env.CI ? 100 : 50
  for (let tries = 0; tries < maxTries; tries++) {
    const actual = (await poll()) ?? ''
    if (actual.indexOf(expected) > -1 || tries === maxTries - 1) {
      expect(actual).toMatch(expected)
      break
    } else {
      await timeout(50)
    }
  }
}

/**
 * Send the rebuild complete message in build watch
 */
export { notifyRebuildComplete } from '../scripts/vitestSetup'

export const extractSourcemap = (content: string) => {
  const lines = content.trim().split('\n')
  return fromComment(lines[lines.length - 1]).toObject()
}

export const formatSourcemapForSnapshot = (map: any) => {
  const root = normalizePath(testDir())
  const m = { ...map }
  delete m.file
  delete m.names
  m.sources = m.sources.map((source) => source.replace(root, '/root'))
  return m
}
