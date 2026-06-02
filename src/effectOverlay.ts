import type { EditorView } from '@codemirror/view'
import type { TypingEffectEvent } from './changeClassifier'
import { M6X11_FONT_BASE64 } from './hyperTypeFont'
import type { JokerTypeSettings, VisualTheme } from './settings'

const MAX_PARTICLES = 80
const FONT_STYLE_ID = 'jokertype-hypertype-font'

export class EffectOverlay {
  private root: HTMLDivElement
  private particles = new Set<HTMLElement>()

  constructor(private view: EditorView) {
    ensureHyperTypeFont()
    this.root = document.createElement('div')
    this.root.className = 'jokertype-overlay'
    this.view.dom.appendChild(this.root)
  }

  spawn(event: TypingEffectEvent, settings: JokerTypeSettings): boolean {
    if (!shouldSpawnEvent(event, settings)) return false

    const coords = this.coordsFor(event)
    if (!coords) return false

    if (settings.editorShake && !settings.reducedMotion && (event.type === 'enter' || event.type === 'chunk' || event.type === 'delete')) {
      this.shake()
    }

    const token = tokenFor(event)
    const particle = document.createElement('span')
    particle.className = this.classNameFor(event, settings, token)
    particle.textContent = token
    particle.style.left = `${coords.left}px`
    particle.style.top = `${coords.top}px`
    particle.style.setProperty('--jokertype-color', colorFor(event, token, settings.visualTheme))
    particle.style.setProperty('--jokertype-drift-x', driftXFor(token, event))
    particle.style.setProperty('--jokertype-drift-y', driftYFor(event))
    particle.style.setProperty('--jokertype-font-size', fontSizeFor(event, settings))
    particle.style.setProperty('--jokertype-shadow', shadowFor(event, token, settings.visualTheme))
    particle.style.setProperty('--jokertype-animation', animationFor(event, settings))
    particle.addEventListener('animationend', () => this.removeParticle(particle), { once: true })
    this.root.appendChild(particle)
    this.particles.add(particle)

    if (settings.cornerBracketsEnabled && !settings.reducedMotion && shouldShowCorners(event, token)) {
      this.spawnCorners(coords, token, settings)
    }

    this.trimParticles()
    window.setTimeout(() => this.removeParticle(particle), settings.reducedMotion ? 700 : settings.glyphLifetimeMs + 120)
    return true
  }

  destroy(): void {
    for (const particle of this.particles) particle.remove()
    this.particles.clear()
    this.root.remove()
  }

  private coordsFor(event: TypingEffectEvent): { left: number; top: number; height: number } | null {
    const source = this.view.coordsAtPos(event.from)
    const fallback = this.view.coordsAtPos(this.view.state.selection.main.head)
    const coords = source ?? fallback
    if (!coords) return null

    const editorRect = this.view.dom.getBoundingClientRect()
    return {
      left: coords.left - editorRect.left,
      top: coords.top - editorRect.top,
      height: coords.bottom - coords.top
    }
  }

  private classNameFor(event: TypingEffectEvent, settings: JokerTypeSettings, token: string): string {
    const classes = ['jokertype-particle', `jokertype-${event.type}`, `jokertype-token-${tokenKind(token)}`, `jokertype-theme-${settings.visualTheme}`, `jokertype-intensity-${settings.effectIntensity}`]
    if (settings.reducedMotion) classes.push('jokertype-reduced-motion')
    return classes.join(' ')
  }

  private spawnCorners(coords: { left: number; top: number; height: number }, token: string, settings: JokerTypeSettings): void {
    const corners = document.createElement('span')
    corners.className = `jokertype-corners jokertype-corners-${tokenKind(token)}`
    corners.style.left = `${coords.left}px`
    corners.style.top = `${coords.top + coords.height / 2}px`
    corners.style.setProperty('--jokertype-corner-duration', `${Math.min(620, Math.max(320, settings.glyphLifetimeMs * 0.45))}ms`)
    corners.style.setProperty('--jokertype-corner-color', cornerColorFor(token, settings.visualTheme))
    corners.addEventListener('animationend', () => this.removeParticle(corners), { once: true })
    this.root.appendChild(corners)
    this.particles.add(corners)
    window.setTimeout(() => this.removeParticle(corners), 700)
  }

  private shake(): void {
    const target = this.view.dom.closest('.workspace-leaf-content') ?? this.view.dom
    target.classList.remove('jokertype-shake')
    void (target as HTMLElement).offsetWidth
    target.classList.add('jokertype-shake')
    window.setTimeout(() => target.classList.remove('jokertype-shake'), 120)
  }

  private trimParticles(): void {
    while (this.particles.size > MAX_PARTICLES) {
      const first = this.particles.values().next().value
      if (!first) return
      this.removeParticle(first)
    }
  }

  private removeParticle(particle: HTMLElement): void {
    particle.remove()
    this.particles.delete(particle)
  }
}

function ensureHyperTypeFont(): void {
  if (document.getElementById(FONT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = FONT_STYLE_ID
  style.textContent = `@font-face{font-family:"HyperTypePixel";src:url("data:font/ttf;base64,${M6X11_FONT_BASE64}") format("truetype");font-weight:400;font-style:normal;font-display:block;}`
  document.head.appendChild(style)
}

function tokenFor(event: TypingEffectEvent): string {
  if (event.type === 'char') {
    if (event.text === ' ') return 'SPACE'
    if (event.text === '\n') return 'ENTER'
    if (event.text === '\t') return 'TAB'
    if (/^[A-Z]$/.test(event.text)) return `SHIFT+${event.text}`
    return event.text.toUpperCase()
  }
  if (event.type === 'enter') return 'ENTER'
  if (event.type === 'tab') return 'TAB'
  if (event.type === 'delete') return event.direction === 'forward' ? 'DELETE' : 'BACKSPACE'
  return 'PASTE'
}

function shouldSpawnEvent(event: TypingEffectEvent, settings: JokerTypeSettings): boolean {
  if (!settings.textGlyphsEnabled) return false
  if (event.type === 'enter') return settings.enterEffectsEnabled
  if (event.type === 'delete') return settings.deleteEffectsEnabled
  return true
}

function tokenKind(token: string): string {
  if (token === 'SPACE' || token === 'ENTER' || token === 'TAB' || token === 'BACKSPACE' || token === 'DELETE') return 'special'
  if (token.startsWith('SHIFT+')) return 'shift'
  return 'letter'
}

function colorFor(event: TypingEffectEvent, token: string, theme: VisualTheme): string {
  if (theme === 'monochrome') {
    if (event.type === 'delete') return '#f2f2f2'
    if (event.type === 'chunk') return '#d7d7d7'
    return '#ffffff'
  }

  if (theme === 'terminal') {
    if (event.type === 'delete') return '#ff5f5f'
    if (event.type === 'enter') return '#7cff9b'
    if (event.type === 'chunk') return '#b6ff7c'
    return '#46ff74'
  }

  if (theme === 'neon') {
    if (event.type === 'enter') return '#00f5ff'
    if (event.type === 'tab') return '#b56cff'
    if (event.type === 'delete') return '#ff3b8d'
    if (event.type === 'chunk') return '#39ff14'
    if (token === 'SPACE') return '#00f5ff'
    if (token.startsWith('SHIFT+')) return '#ff3bff'
    if (/^[0-9]$/.test(token)) return '#39ff14'
    if (/^[.,;:!?'"()[\]{}<>/\\|`~@#$%^&*_+=-]$/.test(token)) return '#b56cff'
    return '#ffe95c'
  }

  if (event.type === 'enter') return '#79f2ff'
  if (event.type === 'tab') return '#c79cff'
  if (event.type === 'delete') return '#ff6b6b'
  if (event.type === 'chunk') return '#9cff7a'
  if (token === 'SPACE') return '#79f2ff'
  if (token.startsWith('SHIFT+')) return '#ff7bf7'
  if (/^[0-9]$/.test(token)) return '#9cff7a'
  if (/^[.,;:!?'"()[\]{}<>/\\|`~@#$%^&*_+=-]$/.test(token)) return '#c79cff'
  return '#ffdf6e'
}

function fontSizeFor(event: TypingEffectEvent, settings: JokerTypeSettings): string {
  const base = settings.effectIntensity === 'low' ? 20 : settings.effectIntensity === 'high' ? 34 : 26
  if (event.type === 'enter') return `${base + 8}px`
  if (event.type === 'tab' || event.type === 'delete' || event.type === 'chunk') return `${base + 4}px`
  return `${base}px`
}

function animationFor(event: TypingEffectEvent, settings: JokerTypeSettings): string {
  if (settings.reducedMotion) return 'jokertype-pulse 520ms ease-out forwards'
  const duration = settings.glyphLifetimeMs
  if (event.type === 'enter') return `jokertype-pop-big ${duration}ms cubic-bezier(.15,.9,.25,1) forwards`
  if (event.type === 'chunk') return `jokertype-pop-big ${duration}ms cubic-bezier(.15,.9,.25,1) forwards`
  if (event.type === 'delete') return `jokertype-slice ${Math.max(520, duration * 0.8)}ms ease-out forwards`
  return `jokertype-float ${duration}ms cubic-bezier(.15,.9,.25,1) forwards`
}

function driftXFor(token: string, event: TypingEffectEvent): string {
  if (event.type === 'enter' || event.type === 'tab') return '0px'
  if (event.type === 'delete') return '18px'
  if (token === 'PASTE') return '0px'
  if (token === 'SPACE') return '-8px'
  return '-16px'
}

function driftYFor(event: TypingEffectEvent): string {
  if (event.type === 'enter' || event.type === 'chunk') return '-78px'
  if (event.type === 'tab') return '-54px'
  if (event.type === 'delete') return '-32px'
  return '-42px'
}

function shadowFor(event: TypingEffectEvent, token: string, theme: VisualTheme): string {
  const glow = colorFor(event, token, theme)
  if (theme === 'monochrome') return '2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 0 0 8px #fff'
  return `2px 0 #111, -2px 0 #111, 0 2px #111, 0 -2px #111, 0 0 10px ${glow}`
}

function shouldShowCorners(event: TypingEffectEvent, token: string): boolean {
  if (event.type === 'enter' || event.type === 'tab' || event.type === 'delete' || event.type === 'chunk') return false
  return token.length > 0
}

function cornerColorFor(token: string, theme: VisualTheme): string {
  if (theme === 'monochrome') return '#ffffff'
  if (theme === 'terminal') return '#46ff74'
  if (theme === 'neon') return tokenKind(token) === 'letter' ? '#00f5ff' : '#ff3bff'
  return tokenKind(token) === 'letter' ? '#00ffff' : '#ff00ff'
}
