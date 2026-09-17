// Convert the calibrated .dark oklch values (globals.css balance pass) to hex
// so the hardcoded recharts palettes in DashboardPage match the token palette.

function oklchToRgb(L: number, C: number, Hdeg: number): [number, number, number] {
  const hr = (Hdeg * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  const toSrgb = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055

  return [toSrgb(lr), toSrgb(lg), toSrgb(lb)]
}

function hex(L: number, C: number, H: number): string {
  const [r, g, b] = oklchToRgb(L, C, H).map((v) =>
    Math.max(0, Math.min(255, Math.round(v * 255))),
  )
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// Calibrated .dark accents from globals.css (Task 28 balance pass)
console.log('emerald-400 (COMPLETED):', hex(0.76, 0.155, 163))
console.log('emerald-500:', hex(0.71, 0.15, 162))
console.log('amber-400 (IN_PROGRESS):', hex(0.8, 0.165, 82))
console.log('amber-500:', hex(0.75, 0.16, 70))
console.log('red-400 (BLOCKED/HIGH):', hex(0.72, 0.165, 24))
console.log('red-500:', hex(0.66, 0.19, 26))
// Neutrals for LOW / NOT_STARTED / cumulative line — warm stone, lifted for dark
console.log('stone chart gray:', hex(0.68, 0.012, 85))
console.log('cumulative gray:', hex(0.72, 0.014, 85))
