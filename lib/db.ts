// lib/db.ts
// Firebase Realtime Database üzerindeki tüm okuma/yazma işlemleri.

import { db } from './firebase'
import {
  ref, set, get, push, onValue, off,
  update, serverTimestamp, remove
} from 'firebase/database'
import type { Player, Vote, RoundResult, PlayerDataset } from '@/lib/gameEngine'

// ── Tip Tanımları ─────────────────────────────────────────────────────────────

export type GameStatus = 'lobby' | 'round_active' | 'round_ended' | 'finished'

export interface GameSession {
  roomCode: string
  hostId: string
  status: GameStatus
  currentRound: number
  currentTopic: string | null
  players: Record<string, Player>
  votes: Record<string, Vote>
  roundResults: RoundResult[]
  createdAt: number
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function createSession(
  roomCode: string,
  hostId: string
): Promise<void> {
  await set(ref(db, `sessions/${roomCode}`), {
    roomCode,
    hostId,
    status: 'lobby',
    currentRound: 0,
    currentTopic: null,
    players: {},
    votes: {},
    roundResults: [],
    createdAt: serverTimestamp(),
  })
}

export async function getSession(roomCode: string): Promise<GameSession | null> {
  const snap = await get(ref(db, `sessions/${roomCode}`))
  return snap.exists() ? (snap.val() as GameSession) : null
}

export function subscribeSession(
  roomCode: string,
  cb: (session: GameSession | null) => void
) {
  const r = ref(db, `sessions/${roomCode}`)
  onValue(r, snap => cb(snap.exists() ? snap.val() : null))
  return () => off(r)
}

// ── Oyuncu ────────────────────────────────────────────────────────────────────

export async function joinSession(
  roomCode: string,
  player: Player
): Promise<void> {
  await set(ref(db, `sessions/${roomCode}/players/${player.id}`), player)
}

// ── Tur Yönetimi ──────────────────────────────────────────────────────────────

export async function startRound(
  roomCode: string,
  topic: string,
  roundNumber: number
): Promise<void> {
  await update(ref(db, `sessions/${roomCode}`), {
    status: 'round_active',
    currentTopic: topic,
    currentRound: roundNumber,
    votes: {},          // önceki turdan kalan oyları sil
  })
}

export async function submitVote(
  roomCode: string,
  vote: Vote
): Promise<void> {
  await set(
    ref(db, `sessions/${roomCode}/votes/${vote.voterId}`),
    vote
  )
}

export async function endRound(
  roomCode: string,
  result: RoundResult
): Promise<void> {
  const snap = await get(ref(db, `sessions/${roomCode}/roundResults`))
  const existing: RoundResult[] = snap.val() || []
  await update(ref(db, `sessions/${roomCode}`), {
    status: 'round_ended',
    roundResults: [...existing, result],
  })
}

export async function finishGame(roomCode: string): Promise<void> {
  await update(ref(db, `sessions/${roomCode}`), { status: 'finished' })
}

/**
 * Oyun bittiğinde tüm session verisini
 * 'archive' koleksiyonuna kopyalar.
 * Bu veri silinmez, sonradan analiz için kullanılır.
 */
export async function archiveSession(roomCode: string): Promise<void> {
  const snap = await get(ref(db, `sessions/${roomCode}`))
  if (!snap.exists()) return
  const data = snap.val()
  await set(ref(db, `archive/${roomCode}`), {
    ...data,
    archivedAt: serverTimestamp(),
  })
}

export async function saveDatasets(
  roomCode: string,
  datasets: Record<string, PlayerDataset>
): Promise<void> {
  await set(ref(db, `sessions/${roomCode}/datasets`), datasets)
}

export async function getDatasets(
  roomCode: string
): Promise<Record<string, PlayerDataset> | null> {
  const snap = await get(ref(db, `sessions/${roomCode}/datasets`))
  return snap.exists() ? snap.val() : null
}
