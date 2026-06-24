// lib/gameEngine.ts
// Java'daki RankingEngine ve Player logic'inin TypeScript karşılığı.

export interface Player {
  id: string
  name: string
  joinedAt: number
}

export interface Vote {
  voterId: string
  // rankedIds[0] = en iyi, rankedIds[n-1] = en kötü
  rankedIds: string[]
}

export interface RoundResult {
  topic: string
  scores: Record<string, number>        // playerId → bu turda kazandığı puan
  adjacencyRow: Record<string, Record<string, number>> // voterId → { targetId → verilen puan }
}

/**
 * Java'daki RankingEngine.applyRanking() karşılığı.
 * n-1 oyuncular sıralandığında:
 *   1. sıra → n-1 puan, 2. sıra → n-2, ..., son → 1 puan
 */
export function calculateRoundScores(
  players: Player[],
  votes: Record<string, Vote>,
  topic: string
): RoundResult {
  const n = players.length
  const scores: Record<string, number> = {}
  const adjacencyRow: Record<string, Record<string, number>> = {}

  players.forEach(p => { scores[p.id] = 0 })

  Object.values(votes).forEach(vote => {
    adjacencyRow[vote.voterId] = {}
    vote.rankedIds.forEach((targetId, idx) => {
      const pts = n - 1 - idx   // 1. sıra → n-1, son → 1
      scores[targetId] = (scores[targetId] || 0) + pts
      adjacencyRow[vote.voterId][targetId] = pts
    })
  })

  return { topic, scores, adjacencyRow }
}

export function calculateAverageRanking(
  players: Player[],
  votes: Record<string, Vote>
): { playerId: string; avgRank: number; displayRank: number }[] {
  const rankSums: Record<string, number> = {}
  const rankCounts: Record<string, number> = {}

  players.forEach(p => { rankSums[p.id] = 0; rankCounts[p.id] = 0 })

  Object.values(votes).forEach(vote => {
    vote.rankedIds.forEach((id, idx) => {
      rankSums[id] = (rankSums[id] || 0) + (idx + 1) // 1-tabanlı sıra
      rankCounts[id] = (rankCounts[id] || 0) + 1
    })
  })

  const results = players.map(p => ({
    playerId: p.id,
    avgRank: rankCounts[p.id] > 0 ? rankSums[p.id] / rankCounts[p.id] : 999,
    displayRank: 0,
  }))

  // Sırala (düşük ortalama = üstte)
  results.sort((a, b) => a.avgRank - b.avgRank)

  // 1-2-2-4 mantığı
  let displayRank = 1
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].avgRank === results[i - 1].avgRank) {
      results[i].displayRank = results[i - 1].displayRank
    } else {
      results[i].displayRank = displayRank
    }
    displayRank++
  }

  return results
}

/**
 * Tüm turlardaki adjacency satırlarını birleştirerek
 * tam Adjacency Matrix döner.
 * matrix[i][j] = oyuncu i'nin oyuncu j'ye verdiği TOPLAM puan.
 */
export function buildAdjacencyMatrix(
  players: Player[],
  roundResults: RoundResult[]
): number[][] {
  const n = players.length
  const idIndex: Record<string, number> = {}
  players.forEach((p, i) => { idIndex[p.id] = i })

  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  roundResults.forEach(round => {
    Object.entries(round.adjacencyRow).forEach(([voterId, targets]) => {
      const vi = idIndex[voterId]
      if (vi === undefined) return
      Object.entries(targets).forEach(([targetId, pts]) => {
        const ti = idIndex[targetId]
        if (ti === undefined) return
        matrix[vi][ti] += pts
      })
    })
  })

  return matrix
}

/** Rastgele 6 haneli oda kodu (örn. "A3F9KL") */
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export type CategoryKey = 'analytical' | 'kinesthetic' | 'social' | 'creative' | 'verbal'

export const TOPIC_CATEGORIES: Record<string, CategoryKey> = {
  'Matematik':            'analytical',
  'Yemek Yapma':          'creative',
  'Futbol Oynama':               'kinesthetic',
  'Basket Oynama':            'kinesthetic',
  'Araba Sürme':          'kinesthetic',
  'Para Yönetimi':        'analytical',
  'İlişki Yürütme':       'social',
  'Flörtözlük':  'social',
  'Sabırlılık':                'verbal',
  'Genel Kültür Bilgisi': 'verbal',
  'Sır Saklama':          'social',
  'Refleks':              'kinesthetic',
  'Stand-up Potansiyeli': 'verbal',
  'Yalan Söylerken Yakalanmama': 'verbal',
  'Müzik Kulağı': 'creative',
  'Hijyen': 'social',
  'İstikrarlılık': 'analytical',
  'Giyim Zevki': 'creative',
  'Hafıza': 'analytical',
  'Plan yapabilme': 'creative',
  'Pratik Çözüm Üretme': 'analytical',
  'Mizah': 'verbal',
  'Strateji Kurma': 'analytical',
  'Dans Etme': 'kinesthetic',

  'Liderlik' : 'social',
  'Yeni İnsanlarla Tanışabilme' : 'social',
  'Duygusal Dayanıklılık' : 'social',
  'Odaklanma' : 'analytical',
  'Bulmaca Çözme' : 'analytical',
  'Hediye Seçme' : 'creative',
  'Tasarım Yeteneği' : 'creative',
  'Denge' : 'kinesthetic',
  'El Becerisi' : 'kinesthetic',
  'Politikacı Olma Potansiyeli' : 'analytical',
  'Öz Disiplin' : 'analytical',
  'Pazarlık Yapma' : 'verbal',
  'Takım Oyunculuğu' : 'social',
  'Dakiklik' : 'analytical',
  'Alkol Direnci' : 'kinesthetic',
  'Özgüven' : 'social',
  'Kitap/Film Kültürü' : 'verbal',
  'Merhamet' : 'social',
  'Uykusuzluk Dayanıklılığı' : 'kinesthetic',
  'Kondisyon' : 'kinesthetic',
  'Açlık Dayanıklılığı' : 'kinesthetic',
  'Acı yeme Kapasitesi' : 'kinesthetic',
  'Taklit Etme' : 'verbal'
}

export const CATEGORY_META: Record<CategoryKey, { label: string; color: string }> = {
  analytical:  { label: 'analytical',   color: '#09b9d8' },
  kinesthetic: { label: 'kinesthetic', color: '#e09b05' },
  social:      { label: 'social',     color: '#e6f755' },
  creative:    { label: 'creative',   color: '#8803e0' },
  verbal:      { label: 'verbal',      color: '#009614' },
}

// ── Dataset yapısı ────────────────────────────────────────────────────────────

export interface PlayerDataset {
  playerId: string
  name: string
  // Her kategoride aldığı sıralar: [tur1_sıra, tur2_sıra, ...]
  categoryRanks: Record<CategoryKey, number[]>
  // Bu oyuncunun diğerlerine her turda verdiği sıra
  // "Poyraz" → [1, 3, 2]  (1. turda Poyrazı 1. sıraya koydu, 2. turda 3. sıraya vs)
  givenRanks: Record<string, number[]>
}

/**
 * Her tur sonunda PlayerDataset listesini günceller.
 * roundIndex: 0'dan başlayan tur indeksi
 */
export function updateDatasets(
  datasets: Record<string, PlayerDataset>,
  players: Player[],
  votes: Record<string, Vote>,
  topic: string,
  roundIndex: number
): Record<string, PlayerDataset> {
  const updated = { ...datasets }
  const cat = TOPIC_CATEGORIES[topic] ?? 'social'

  // Bu turdaki ortalama sıralama → her oyuncunun bu turda kaçıncı olduğu
  const rankResult = calculateAverageRanking(players, votes)

  // Dataset'leri init et
  players.forEach(p => {
    if (!updated[p.id]) {
  updated[p.id] = {
    playerId: p.id,
    name: p.name,
    categoryRanks: {
      analytical: [], kinesthetic: [], social: [], creative: [], verbal: []
    },
    givenRanks: {},
  }
} else {
  // Eksik kategorileri tamamla (Firebase'den gelince boş olabilir)
  const cats: CategoryKey[] = ['analytical', 'kinesthetic', 'social', 'creative', 'verbal']
  cats.forEach(c => {
    if (!updated[p.id].categoryRanks[c]) {
      updated[p.id].categoryRanks[c] = []
    }
  })
}
  })

  // Her oyuncunun bu turdaki sırasını ilgili kategoriye ekle
  rankResult.forEach(({ playerId, displayRank }) => {
    updated[playerId].categoryRanks[cat].push(displayRank)
  })

  // Her oyuncunun diğerlerine verdiği sıraları kaydet
  Object.entries(votes).forEach(([voterId, vote]) => {
    if (!updated[voterId]) return
    vote.rankedIds.forEach((targetId, idx) => {
      const targetName = players.find(p => p.id === targetId)?.name
      if (!targetName) return
      if (!updated[voterId].givenRanks[targetName]) {
        updated[voterId].givenRanks[targetName] = []
      }
      updated[voterId].givenRanks[targetName].push(idx + 1) // 1-tabanlı
    })
  })

  return updated
}
