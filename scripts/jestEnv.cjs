const os = require('os')
const fs = require('fs')
const path = require('path')
const NodeEnvironment = require('jest-environment-node')
const { chromium } = require('playwright-chromium')

const DIR = path.join(os.tmpdir(), 'jest_playwright_global_setup')

module.exports = class PlaywrightEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config)
    this.testPath = context.testPath
  }

  async setup() {
    await super.setup()
    const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf-8')
    if (!wsEndpoint) {
      throw new Error('wsEndpoint not found')
    }

    // skip browser setup for non-playground tests
    if (!this.testPath.includes('playground')) {
      return
    }

    const browser = (this.browser = await chromium.connect({
      wsEndpoint
    }))
    this.global.page = await browser.newPage()

    const console = this.global.console
    const warn = console.warn
    console.warn = (msg, ...args) => {
      // suppress @vue/reactivity-transform warning
      if (msg.includes('@vue/reactivity-transform')) return
      if (msg.includes('Generated an empty chunk')) return
      warn.call(console, msg, ...args)
    }
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close()
    }
    await super.teardown()
  }
}
