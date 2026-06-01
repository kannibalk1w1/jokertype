import type { EditorView } from '@codemirror/view'
import type { TypingEffectEvent } from './changeClassifier'
import type { JokerTypeSettings } from './settings'

const MAX_PARTICLES = 80

export class EffectOverlay {
  private root: HTMLDivElement
  private particles = new Set<HTMLElement>()

  constructor(private view: EditorView) {
    this.root = document.createElement('div')
    this.root.className = 'jokertype-overlay'
    this.view.dom.appendChild(this.root)
  }

  spawn(event: TypingEffectEvent, settings: JokerTypeSettings): void {
    const coords = this.coordsFor(event)
    if (!coords) return

    if (settings.editorShake && !settings.reducedMotion && (event.type === 'enter' || event.type === 'chunk' || event.type === 'delete')) {
      this.shake()
    }

    const particle = document.createElement('span')
    particle.className = this.classNameFor(event, settings)
    particle.textContent = labelFor(event)
    particle.style.left = `${coords.left}px`
    particle.style.top = `${coords.top}px`
    particle.addEventListener('animationend', () => this.removeParticle(particle), { once: true })
    this.root.appendChild(particle)
    this.particles.add(particle)
    this.trimParticles()
  }

  destroy(): void {
    for (const particle of this.particles) particle.remove()
    this.particles.clear()
    this.root.remove()
  }

  private coordsFor(event: TypingEffectEvent): { left: number; top: number } | null {
    const source = this.view.coordsAtPos(event.from)
    const fallback = this.view.coordsAtPos(this.view.state.selection.main.head)
    const coords = source ?? fallback
    if (!coords) return null

    const editorRect = this.view.dom.getBoundingClientRect()
    return {
      left: coords.left - editorRect.left,
      top: coords.top - editorRect.top
    }
  }

  private classNameFor(event: TypingEffectEvent, settings: JokerTypeSettings): string {
    const classes = ['jokertype-particle', `jokertype-${event.type}`, `jokertype-intensity-${settings.effectIntensity}`]
    if (settings.reducedMotion) classes.push('jokertype-reduced-motion')
    return classes.join(' ')
  }

  private shake(): void {
    this.view.dom.classList.remove('jokertype-shake')
    void this.view.dom.offsetWidth
    this.view.dom.classList.add('jokertype-shake')
    window.setTimeout(() => this.view.dom.classList.remove('jokertype-shake'), 120)
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

function labelFor(event: TypingEffectEvent): string {
  if (event.type === 'char') return event.text.toUpperCase()
  if (event.type === 'enter') return 'ENTER'
  if (event.type === 'tab') return 'TAB'
  if (event.type === 'delete') return 'SLICE'
  return 'BURST'
}
