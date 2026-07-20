// Generates the synthetic golden set into server/golden/photos/ (gitignored).
// Run from server/: npm run gen-synthetic -w server
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/Users/johaanmannanal/Documents/GitHub/snap-a-mistake/server/golden/photos'

const FONTS = ['Bradley Hand, cursive', 'Comic Sans MS, cursive', 'Marker Felt, fantasy', 'Chalkboard, cursive']

function page(lines: string[], font: string, opts: { size?: number; ink?: string; bg?: string } = {}): Buffer {
  const size = opts.size ?? 40
  const gap = Math.floor(600 / (lines.length + 1))
  const texts = lines
    .map((l, i) => `<text x='55' y='${gap * (i + 1)}' font-family='${font}' font-size='${size}' fill='${opts.ink ?? '#1a2a5e'}'>${l
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n')
  return Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='620'><rect width='800' height='620' fill='${opts.bg ?? '#fdfdf8'}'/>${texts}</svg>`,
  )
}

type Case = { file: string; lines: string[]; blur?: number }

const cases: Case[] = [
  // 4 correct
  { file: 'correct-linear.jpg', lines: ['Solve: 3x - 5 = 7', '3x = 12', 'x = 4'] },
  { file: 'correct-quadratic.jpg', lines: ['x² - 5x + 6 = 0', '(x - 2)(x - 3) = 0', 'x = 2 or x = 3'] },
  { file: 'correct-derivative.jpg', lines: ['f(x) = x³ + 2x', "f'(x) = 3x² + 2"] },
  { file: 'correct-integral.jpg', lines: ['∫ 2x dx', '= x² + C'] },
  // 8 planted errors (first wrong line noted in manifest)
  { file: 'sign-error.jpg', lines: ['Solve: 2x + 6 = 10', '2x = 10 + 6', '2x = 16', 'x = 8'] },
  { file: 'dropped-term.jpg', lines: ['d/dx (x³ + 4x² + x)', '= 3x² + 8x'] },
  { file: 'distribution-error.jpg', lines: ['3(x + 4) = 21', '3x + 4 = 21', '3x = 17', 'x = 17/3'] },
  { file: 'chain-rule-missed.jpg', lines: ['d/dx sin(3x)', '= cos(3x)'] },
  { file: 'product-rule.jpg', lines: ['d/dx (x² · sin x)', '= 2x · cos x'] },
  { file: 'parts-error.jpg', lines: ['∫ x eˣ dx', '= x eˣ - ∫ x eˣ dx', '2∫ x eˣ dx = x eˣ', '= x eˣ / 2'] },
  { file: 'usub-bounds.jpg', lines: ['∫₀² 2x (x²)³ dx', 'u = x², du = 2x dx', '= ∫₀² u³ du', '= [u⁴/4]₀² = 4'] },
  { file: 'exponent-error.jpg', lines: ['Simplify: x² · x³', '= x⁶'] },
  // 3 garbage
  { file: 'blurry.jpg', lines: ['Solve: 5x + 1 = 11', '5x = 10', 'x = 2'], blur: 16 },
  { file: 'grocery-list.jpg', lines: ['Groceries:', '- eggs', '- oat milk', '- bread', '- hot sauce'] },
  { file: 'faint-math.jpg', lines: ['Solve: 7x - 3 = 18', '7x = 21', 'x = 3'], blur: 9 },
]

async function main() {
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!
    const faint = c.file === 'faint-math.jpg'
    let img = sharp(page(c.lines, FONTS[i % FONTS.length]!, faint ? { ink: '#8a8678', size: 34 } : {}))
    if (c.blur) img = img.blur(c.blur)
    await img.jpeg({ quality: 88 }).toFile(path.join(OUT, c.file))
    console.log('wrote', c.file)
  }
}
main()
