import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const forbidden = /fonts\.googleapis\.com|fonts\.gstatic\.com/

function filesUnder(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.endsWith('.test.js')) continue
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) filesUnder(full, acc)
    else if (/\.(html|css|js|jsx)$/.test(name)) acc.push(full)
  }
  return acc
}

describe('lokální písma', () => {
  it('veřejný kód nevolá Google Fonts', () => {
    const targets = [path.join(root, 'index.html'), ...filesUnder(path.join(root, 'src'))]
    const hits = []
    for (const file of targets) {
      const text = readFileSync(file, 'utf8')
      if (forbidden.test(text)) hits.push(path.relative(root, file))
    }
    assert.deepEqual(hits, [])
  })

  it('lokální stylesheet drží obě rodiny, woff2 a font-display swap', () => {
    const css = readFileSync(path.join(root, 'src/fonts/local.css'), 'utf8')
    assert.match(css, /font-family:\s*"Fraunces"/)
    assert.match(css, /font-family:\s*"Plus Jakarta Sans"/)
    assert.match(css, /font-weight:\s*560 720/)
    assert.match(css, /font-weight:\s*400/)
    assert.match(css, /font-weight:\s*800/)
    assert.equal(css.includes('font-display: swap'), true)
    assert.match(css, /url\("\.\/[^"]+\.woff2"\)/)
    assert.equal(css.includes('http'), false)
  })
})
