'use client'
import { useEffect, useRef, useMemo } from 'react'

// ── Import'lar gameEngine'den ─────────────────────────────────────────────────
import { TOPIC_CATEGORIES, CATEGORY_META, type CategoryKey } from '@/lib/gameEngine'

// ── Renk yardımcıları (en üstte, her şeyden önce) ────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/\d+/g)!
    return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])]
  }
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function toRgba(hex: string, alpha: number): string {
  const [r,g,b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

function lerp(c1: string, c2: string, t: number): string {
  const [r1,g1,b1] = hexToRgb(c1)
  const [r2,g2,b2] = hexToRgb(c2)
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
}

// ── Renk hesaplama ────────────────────────────────────────────────────────────

function getPlayerColor(player: NetworkPlayer, allPlayers: NetworkPlayer[]): string {
  const RED = '#c01717'
  const n = allPlayers.length
  const qualifyingRanks = n <= 3 ? [1] : n <= 7 ? [1, 2] : [1, 2, 3]

  // categoryRanks yoksa topicScores'a düş
  if (!player.categoryRanks) {
    return getColorFromTopicScores(player, allPlayers)
  }

  const cats: CategoryKey[] = ['analytical', 'kinesthetic', 'social', 'creative', 'verbal']
  
  const qualified: { cat: CategoryKey; bestRank: number }[] = []

  cats.forEach(cat => {
    const ranks = player.categoryRanks![cat]
    if (!ranks || ranks.length === 0) return
    // Bu kategoride en iyi sırası kaç?
    const bestRank = Math.min(...ranks)
    if (qualifyingRanks.includes(bestRank)) {
      qualified.push({ cat, bestRank })
    }
  })

  if (qualified.length === 0) return RED

  // En iyi sıraya sahip kategori
  qualified.sort((a, b) => {
  // Önce 1.'lik sayısına bak
  const aOnes = player.categoryRanks![a.cat].filter(r => r === 1).length
  const bOnes = player.categoryRanks![b.cat].filter(r => r === 1).length
  if (bOnes !== aOnes) return bOnes - aOnes  // fazla 1.'lik önce

  // Eşitse en iyi sıraya bak
  if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank

  // Hala eşitse qualifying sıra sayısına bak
  const aCount = player.categoryRanks![a.cat].filter(r => qualifyingRanks.includes(r)).length
  const bCount = player.categoryRanks![b.cat].filter(r => qualifyingRanks.includes(r)).length
  return bCount - aCount
})
  return CATEGORY_META[qualified[0].cat].color
}

function getColorFromTopicScores(player: NetworkPlayer, allPlayers: NetworkPlayer[]): string {
  const RED = '#c01717'
  const n = allPlayers.length
  const qualifyingRanks = n <= 3 ? [1] : n <= 7 ? [1, 2] : [1, 2, 3]

  const catScores: Partial<Record<CategoryKey, Record<string, number>>> = {}
  allPlayers.forEach(p => {
    Object.entries(p.topicScores).forEach(([topic, score]) => {
      const cat = TOPIC_CATEGORIES[topic]
      if (!cat) return
      if (!catScores[cat]) catScores[cat] = {}
      catScores[cat]![p.id] = (catScores[cat]![p.id] || 0) + score
    })
  })

  const qualified: { cat: CategoryKey; rank: number }[] = []
  Object.entries(catScores).forEach(([cat, scores]) => {
    if (!scores) return
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
    const pos = sorted.findIndex(([id]) => id === player.id) + 1
    if (pos > 0 && qualifyingRanks.includes(pos)) {
      qualified.push({ cat: cat as CategoryKey, rank: pos })
    }
  })

  if (qualified.length === 0) return RED
  qualified.sort((a, b) => a.rank - b.rank)
  return CATEGORY_META[qualified[0].cat].color
}

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface NetworkPlayer {
  id: string
  name: string
  totalScore: number
  topicScores: Record<string, number>
  categoryRanks?: Record<CategoryKey, number[]> | null
}

export interface NetworkEdge {
  fromId: string
  toId: string
  weight: number
}

interface Particle {
  edgeIdx: number
  t: number
  speed: number
  size: number
  opacity: number
  reverse: boolean
}

interface AuraParticle {
  nodeIdx: number
  angle: number
  speed: number
  radius: number
  size: number
  opacity: number
}

interface Props {
  players: NetworkPlayer[]
  edges: NetworkEdge[]
  width?: number
  height?: number
  showLabels?: boolean
}

// ── Bileşen ───────────────────────────────────────────────────────────────────

export default function NetworkGraph({ players, edges, width = 600, height = 500, showLabels = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const psRef     = useRef<Particle[]>([])
  const apRef     = useRef<AuraParticle[]>([])

  const cx = width / 2
  const cy = height / 2
  const orbitR = Math.min(width, height) * 0.32
  const n = players.length
  const minR = 22, maxR = 40

  const positions = useMemo(() =>
    players.map((_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2
      return { x: cx + orbitR * Math.cos(a), y: cy + orbitR * Math.sin(a) }
    })
  , [players, n, cx, cy, orbitR])

  const scores  = players.map(p => p.totalScore)
  const maxS    = Math.max(...scores, 1)
  const minS    = Math.min(...scores, 0)
  const radii   = players.map(p => minR + ((p.totalScore - minS) / (maxS - minS || 1)) * (maxR - minR))
  const colors  = useMemo(() => players.map(p => getPlayerColor(p, players)), [players])

  const edgeMap: Record<string, number> = {}
  edges.forEach(e => { edgeMap[`${e.fromId}→${e.toId}`] = e.weight })

  const pairs = useMemo(() => {
    const res: { ai: number; bi: number; wAB: number; wBA: number }[] = []
    for (let ai = 0; ai < n; ai++) {
      for (let bi = ai + 1; bi < n; bi++) {
        const wAB = edgeMap[`${players[ai].id}→${players[bi].id}`] ?? 0
        const wBA = edgeMap[`${players[bi].id}→${players[ai].id}`] ?? 0
        if (wAB + wBA > 0.01) res.push({ ai, bi, wAB, wBA })
      }
    }
    return res
  }, [players, edges])

  // Partikülleri init
  useEffect(() => {
    const ps: Particle[] = []
    pairs.forEach((pair, ei) => {
      if (pair.wAB > 0.01) {
        const cnt = Math.max(3, Math.round(pair.wAB * 18))
        for (let i = 0; i < cnt; i++) {
          ps.push({
            edgeIdx: ei, t: Math.random(),
            speed: 0.0008 + pair.wAB * 0.004,
            size: 1.5 + pair.wAB * 4,
            opacity: 0.1 + pair.wAB * 0.85,
            reverse: false,
          })
        }
      }
      if (pair.wBA > 0.01) {
        const cnt = Math.max(3, Math.round(pair.wBA * 18))
        for (let i = 0; i < cnt; i++) {
          ps.push({
            edgeIdx: ei, t: Math.random(),
            speed: 0.0008 + pair.wBA * 0.004,
            size: 1.2 + pair.wBA * 4,
            opacity: 0.1 + pair.wBA * 0.85,
            reverse: true,
          })
        }
      }
    })
    psRef.current = ps

    const aps: AuraParticle[] = []
    players.forEach((_, ni) => {
      const cnt = 5 + Math.round((radii[ni] - minR) / (maxR - minR) * 8)
      for (let i = 0; i < cnt; i++) {
        aps.push({
          nodeIdx: ni,
          angle: (2 * Math.PI * i) / cnt + Math.random() * 0.5,
          speed: (0.003 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
          radius: radii[ni] + 6 + Math.random() * 10,
          size: 1 + Math.random() * 1.5,
          opacity: 0.1 + Math.random() * 0.3,
        })
      }
    })
    apRef.current = aps
  }, [players, pairs])

  // Animasyon döngüsü
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Closure snapshot — useEffect içinde güncel değerleri yakala
    const colorsSnap   = colors
    const posSnap      = positions
    const radiiSnap    = radii
    const pairsSnap    = pairs

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      // ── AURA ──
      apRef.current.forEach(ap => {
        ap.angle += ap.speed
        const pos = posSnap[ap.nodeIdx]
        const x = pos.x + Math.cos(ap.angle) * ap.radius
        const y = pos.y + Math.sin(ap.angle) * ap.radius
        ctx.beginPath()
        ctx.arc(x, y, ap.size, 0, Math.PI * 2)
        ctx.fillStyle = toRgba(colorsSnap[ap.nodeIdx], ap.opacity)
        ctx.fill()
      })

      // ── PARTİKÜLLER ──
      psRef.current.forEach(p => {
        p.t += p.speed
        if (p.t > 1) p.t -= 1

        const pair = pairsSnap[p.edgeIdx]
        if (!pair) return

        const pa   = posSnap[pair.ai]
        const pb   = posSnap[pair.bi]
        const dx   = pb.x - pa.x
        const dy   = pb.y - pa.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        const tS   = radiiSnap[pair.ai] / dist
        const tE   = 1 - radiiSnap[pair.bi] / dist
        const tRaw = p.reverse ? 1 - p.t : p.t
        const tC   = tS + tRaw * (tE - tS)

        const x = pa.x + dx * tC
        const y = pa.y + dy * tC

        const colA = colorsSnap[pair.ai]
        const colB = colorsSnap[pair.bi]

        // A→B: A rengiyle başla, son %15'te B'ye geç
        // B→A: B rengiyle başla, son %15'te A'ya geç
        const col = p.reverse ? colB : colA

        const [R, G, B] = hexToRgb(col)

        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, p.size * 2.8)
        glow.addColorStop(0,   `rgba(${R},${G},${B},${p.opacity * 0.9})`)
        glow.addColorStop(0.5, `rgba(${R},${G},${B},${p.opacity * 0.35})`)
        glow.addColorStop(1,   `rgba(${R},${G},${B},0)`)
        ctx.beginPath()
        ctx.arc(x, y, p.size * 2.8, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Ana top
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = toRgba(col, p.opacity)
        ctx.fill()
      })

      // ── NODE'LAR ──
      players.forEach((p, i) => {
        const pos = posSnap[i]
        const r   = radiiSnap[i]
        const col = colorsSnap[i]
        const [R, G, B] = hexToRgb(col)

        // Glow
        const glow = ctx.createRadialGradient(pos.x, pos.y, r*0.3, pos.x, pos.y, r*2.8)
        glow.addColorStop(0,   `rgba(${R},${G},${B},0.2)`)
        glow.addColorStop(0.5, `rgba(${R},${G},${B},0.07)`)
        glow.addColorStop(1,   `rgba(${R},${G},${B},0)`)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r*2.8, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Dış halka
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r+5, 0, Math.PI * 2)
        ctx.strokeStyle = toRgba(col, 0.15)
        ctx.lineWidth = 1
        ctx.stroke()

        // Dolgu
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
        ctx.fillStyle = toRgba(col, 0.1)
        ctx.fill()

        // Kenar
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = toRgba(col, 0.88)
        ctx.lineWidth = 1.5
        ctx.stroke()

        // İsim
        if (showLabels) {
          ctx.font = `500 12px sans-serif`
          ctx.fillStyle = toRgba(col, 0.9)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(p.name, pos.x, pos.y + r + 8)
        }
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [players, positions, colors, radii, pairs, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block', background: 'transparent' }}
    />
  )
}

// ── Veri dönüştürücü ──────────────────────────────────────────────────────────

import type { GameSession } from '@/lib/db'
import type { Player } from '@/lib/gameEngine'

export function buildNetworkData(
  session: GameSession,
  datasets?: Record<string, any> | null
): {
  players: NetworkPlayer[]
  edges: NetworkEdge[]
} {
  const rawPlayers = Object.values(session.players || {}) as Player[]
  const results    = session.roundResults || []

  const totalScores: Record<string, number> = {}
  const topicScores: Record<string, Record<string, number>> = {}
  rawPlayers.forEach(p => { totalScores[p.id] = 0; topicScores[p.id] = {} })

  results.forEach(r => {
    Object.entries(r.scores || {}).forEach(([id, pts]) => {
      totalScores[id] = (totalScores[id] || 0) + pts
      topicScores[id][r.topic] = (topicScores[id][r.topic] || 0) + pts
    })
  })

  const given: Record<string, Record<string, number>> = {}
  rawPlayers.forEach(p => { given[p.id] = {} })

  results.forEach(r => {
    Object.entries(r.adjacencyRow || {}).forEach(([voterId, targets]) => {
      if (!given[voterId]) given[voterId] = {}
      Object.entries(targets || {}).forEach(([targetId, pts]) => {
        given[voterId][targetId] = (given[voterId][targetId] || 0) + (pts as number)
      })
    })
  })

  const allGiven = Object.values(given).flatMap(g => Object.values(g))
  const maxGiven = Math.max(...allGiven, 1) * 0.7

  const players: NetworkPlayer[] = rawPlayers.map(p => ({
  id: p.id,
  name: p.name,
  totalScore: totalScores[p.id] || 0,
  topicScores: topicScores[p.id] || {},
  categoryRanks: datasets?.[p.id]?.categoryRanks || null,
})) 

const edges: NetworkEdge[] = [];

const MIN_OPACITY = 0.05;
const MAX_OPACITY = 1.0;

rawPlayers.forEach(from => {
  // --- 1. ADIM: Bu oyuncunun (from) verdiği tüm oyları topla ve min/max bul ---
  const currentGivenRanks: number[] = [];
  
  rawPlayers.forEach(to => {
    if (from.id === to.id) return;
    const ranks = datasets?.[from.id]?.givenRanks?.[to.name];
    if (ranks && ranks.length > 0) {
      const avg = ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length;
      currentGivenRanks.push(avg);
    }
  });

  // Bu node'un verdiği en iyi (min sayı) ve en kötü (max sayı) sıralama
  const nodeBestRank = Math.min(...currentGivenRanks); 
  const nodeWorstRank = Math.max(...currentGivenRanks);
  const range = nodeWorstRank - nodeBestRank;

  // --- 2. ADIM: Şimdi bu node'un edge'lerini kendi içinde normalize et ---
  rawPlayers.forEach(to => {
    if (from.id === to.id) return;

    let finalWeight = 0.2; // Default

    if (datasets) {
      const ranks = datasets[from.id]?.givenRanks?.[to.name];

      if (ranks && ranks.length > 0) {
        const avgRank = ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length;

        // Kendi içindeki sıralamasına göre 0.0 ile 1.0 arası başarı oranı
        // Eğer range 0 ise (herkese aynı puanı verdiyse) direkt 1.0 veriyoruz.
        let successRate = range === 0 ? 1.0 : (nodeWorstRank - avgRank) / range;
        
        // Hassasiyet eğrisi (Kendi içindeki farkı vurgula)
        const sensitiveRate = Math.pow(successRate, 1.3);

        // Mapping: 0.05 - 1.0 arasına yay
        finalWeight = MIN_OPACITY + (sensitiveRate * (MAX_OPACITY - MIN_OPACITY));
      }
    }

    edges.push({ 
      fromId: from.id, 
      toId: to.id, 
      weight: parseFloat(finalWeight.toFixed(4)),
    });
  });
});

  return { players, edges }
}
