'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeSession, submitVote } from '@/lib/db'
import type { GameSession } from '@/lib/db'
import Avatar from '@/components/Avatar'
import styles from './room.module.css'
import { calculateAverageRanking, type Player } from '@/lib/gameEngine'
import { markReadyForNext, advanceToNextRound } from '@/lib/db'

import NetworkGraph, { buildNetworkData} from '@/components/NetworkGraph'

interface Props { params: { code: string } }

export default function RoomPage({ params }: Props) {
  const { code } = params
  const router = useRouter()
  const [session, setSession] = useState<GameSession | null>(null)
  const [me, setMe] = useState<Player | null>(null)
  const [rankOrder, setRankOrder] = useState<Player[]>([])
  const [voted, setVoted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const touchStartY = useRef<number>(0)
  const itemHeight = useRef<number>(72)
  const [readyPressed, setReadyPressed] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(`synergia_player_${code}`)
    if (!raw) { router.replace(`/join/${code}`); return }
    setMe(JSON.parse(raw))
  }, [code, router])

  useEffect(() => {
    return subscribeSession(code, s => {
      if (!s) return
      setSession(s)
    })
  }, [code])

  useEffect(() => {
    if (!session || !me) return
    if (session.status === 'round_active') {
      const alreadyVoted = !!session.votes?.[me.id]
      setVoted(alreadyVoted)
      if (!alreadyVoted) {
        const others = Object.values(session.players || {}).filter(p => p.id !== me.id) as Player[]
        setRankOrder(others)
      }
    }
  }, [session?.status, session?.currentRound]) // eslint-disable-line

  useEffect(() => {
    if (!session || !me) return
    if (session.status !== 'round_ended') return
    if (!session.autoMode) return

    const players = Object.values(session.players || {}) as Player[]
    const ready = Object.keys(session.readyForNext || {})
    if (ready.length >= players.length && players.length > 1) {
      // Herkes hazır, ilk hazır olan geçişi tetikler
      if (ready[0] === me.id) {
        advanceToNextRound(code, session)
      }
    }
  }, [session?.readyForNext, session?.status])

  useEffect(() => {
    if (session?.status === 'round_active') {
      setReadyPressed(false)
      setVoted(false)
    }
  }, [session?.status, session?.currentRound])

  if (!session || !me) {
    return <div className="page-center"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
  }

  const players = Object.values(session.players || {}) as Player[]
  const myIndex = players.findIndex(p => p.id === me.id)

  // ── PC: Drag & Drop ──
  function onDragStart(e: React.DragEvent, idx: number) {
    dragItem.current = idx
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnter(idx: number) {
    if (dragItem.current === idx) return
    dragOver.current = idx
    setOverIdx(idx)
    // Anlık sıralama güncelle
    const list = [...rankOrder]
    const [moved] = list.splice(dragItem.current!, 1)
    list.splice(idx, 0, moved)
    dragItem.current = idx
    setRankOrder(list)
  }
  function onDragEnd() {
    setDraggingIdx(null)
    setOverIdx(null)
    dragItem.current = null
    dragOver.current = null
  }

  // ── Mobil: Touch ──
  function onTouchStart(e: React.TouchEvent, idx: number) {
    dragItem.current = idx
    setDraggingIdx(idx)
    touchStartY.current = e.touches[0].clientY
    const el = e.currentTarget as HTMLElement
    itemHeight.current = el.offsetHeight + 8
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const touch = e.touches[0]
    const deltaY = touch.clientY - touchStartY.current
    const moved = Math.round(deltaY / itemHeight.current)
    if (moved === 0 || dragItem.current === null) return
    const newIdx = Math.max(0, Math.min(rankOrder.length - 1, (dragItem.current ?? 0) + moved))
    if (newIdx !== dragItem.current) {
      const list = [...rankOrder]
      const [item] = list.splice(dragItem.current, 1)
      list.splice(newIdx, 0, item)
      setOverIdx(newIdx)
      dragItem.current = newIdx
      touchStartY.current = touch.clientY
      setRankOrder(list)
    }
  }
  function onTouchEnd() {
    setDraggingIdx(null)
    setOverIdx(null)
    dragItem.current = null
  }

  // ── Ok butonları (alternatif) ──
  function moveUp(idx: number) {
    if (idx === 0) return
    const list = [...rankOrder]
    ;[list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]
    setRankOrder(list)
  }
  function moveDown(idx: number) {
    if (idx === rankOrder.length - 1) return
    const list = [...rankOrder]
    ;[list[idx], list[idx + 1]] = [list[idx + 1], list[idx]]
    setRankOrder(list)
  }

  async function handleVote() {
    if (!me) return
    setSubmitting(true)
    await submitVote(code, {
      voterId: me.id,
      rankedIds: rankOrder.map(p => p.id),
    })
    setVoted(true)
    setSubmitting(false)
  }

  // ── LOBI ──
  if (session.status === 'lobby') {
    return (
      <div className="page-center">
        <div className={`card anim-fade-up ${styles.lobbyCard}`}>
          <div className={styles.lobbyTop}>
            <Avatar name={me.name} index={myIndex >= 0 ? myIndex : 0} size={52} />
            <div>
              <p className={styles.lobbyName}>{me.name}</p>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Oda: <span className="mono" style={{ color: 'var(--accent)' }}>{code}</span>
              </p>
            </div>
          </div>
          <div className="sep" />
          <p className="label">Bağlanan oyuncular ({players.length})</p>
          <div className={styles.playerGrid}>
            {players.map((p, i) => (
              <div key={p.id} className={styles.playerChip}>
                <Avatar name={p.name} index={i} size={28} />
                <span style={{ fontSize: 13 }}>{p.name}</span>
                {p.id === me.id && <span className="badge badge-green" style={{ fontSize: 11 }}>Sen</span>}
              </div>
            ))}
          </div>
          <div className="sep" />
          <div className={styles.waitingRow}>
            <div className="spinner" />
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>Host turu başlatana kadar bekle…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── TUR AKTİF — sıralama ekranı ──
  if (session.status === 'round_active' && !voted) {
    return (
      <div className={styles.rankPage}>
        <div className={styles.rankHeader}>
          <div className={styles.rankHeaderInner}>
            <div>
              <p className={styles.rankTitle}>Sırala</p>
              <p className={styles.rankTopic}>
                <span className={styles.topicChip}>{session.currentTopic}</span>
              </p>
            </div>
            <div className={styles.rankHint}>
              <span>↑↓</span> ok veya sürükle
            </div>
          </div>
          {/* Numara göstergesi */}
          <div className={styles.rankNums}>
            {rankOrder.map((_, i) => (
              <div key={i} className={`${styles.rankNumDot} ${i === 0 ? styles.rankNumFirst : i === rankOrder.length - 1 ? styles.rankNumLast : ''}`}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rankList}>
          {rankOrder.map((p, idx) => {
            const pi = players.findIndex(x => x.id === p.id)
            const isDragging = draggingIdx === idx
            const isFirst = idx === 0
            const isLast = idx === rankOrder.length - 1

            return (
              <div
                key={p.id}
                data-rank-idx={idx}
                className={`${styles.rankItem} ${isDragging ? styles.rankItemDragging : ''} ${isFirst ? styles.rankItemFirst : ''} ${isLast ? styles.rankItemLast : ''}`}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                onTouchStart={e => onTouchStart(e, idx)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Sol: sıra numarası */}
                <div className={`${styles.rankBadge} ${isFirst ? styles.rankBadgeFirst : isLast ? styles.rankBadgeLast : ''}`}>
                  {isLast ? '💩' : idx + 1}
                </div>

                <Avatar name={p.name} index={pi >= 0 ? pi : idx} size={40} />

                <span className={styles.rankName}>{p.name}</span>

                {/* Ok butonları */}
                <div className={styles.arrowBtns}>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="Yukarı taşı"
                  >▲</button>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveDown(idx)}
                    disabled={idx === rankOrder.length - 1}
                    title="Aşağı taşı"
                  >▼</button>
                </div>

                {/* Sürükle ikonu */}
                <div className={styles.dragHandle}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="5" cy="4" r="1.2" fill="currentColor"/>
                    <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
                    <circle cx="5" cy="12" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="4" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="12" r="1.2" fill="currentColor"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.rankFooter}>
          <p className={styles.footerHint}>
            1. sıra en iyi · son sıra en kötü
          </p>
          <button
            className="btn btn-accent"
            style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 15, borderRadius: 12 }}
            onClick={handleVote}
            disabled={submitting}
          >
            {submitting ? <span className="spinner" /> : '✓ Oyumu gönder'}
          </button>
        </div>
      </div>
    )
  }

  // ── OY VERİLDİ ──
  if (session.status === 'round_active' && voted) {
    const voteCount = Object.keys(session.votes || {}).length
    return (
      <div className="page-center">
        <div className={`card anim-fade-up ${styles.waitCard}`}>
          <div className={styles.checkCircle}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 14l5 5 9-9" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Oy gönderildi!</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: '1.25rem' }}>
            Diğer oyuncular bekleniyor…
          </p>
          <div className={styles.voteProgress}>
            <div style={{ flex: 1, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--accent)', borderRadius: 99,
                width: `${players.length ? (voteCount / players.length) * 100 : 0}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
              {voteCount}/{players.length}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── TUR BİTTİ ──
  if (session.status === 'round_ended') {
  const lastResult = session.roundResults?.[session.roundResults.length - 1]
  const lastVotes = session.votes || {}
  const ranking = calculateAverageRanking(players, lastVotes)

  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div className="page-center">
      <div className={`card anim-fade-up ${styles.resultsCard}`}>
        <p className={styles.resultsLabel}>Tur {session.currentRound} · {lastResult?.topic}</p>
        <p className={styles.resultsTopic}>Ortalama sıralama</p>
        <div className="sep" />
        {ranking.map(({ playerId, avgRank, displayRank }) => {
          const p = players.find(x => x.id === playerId)
          if (!p) return null
          const pi = players.findIndex(x => x.id === p.id)
          const isMe = p.id === me.id
          return (
            <div key={playerId} className={`${styles.resultRow} ${isMe ? styles.resultRowMe : ''}`}>
              <span className={styles.resultRank}>
                {medals[displayRank] || `${displayRank}.`}
              </span>
              <Avatar name={p.name} index={pi} size={32} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 600 : 400 }}>
                {p.name} {isMe && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(sen)</span>}
              </span>
              <span className={`mono ${styles.resultAvg}`}>
                ⌀ {avgRank.toFixed(1)}
              </span>
            </div>
          )
        })}
        <div className="sep" />
        <p style={{ fontSize: 13, color: 'var(--hint)', textAlign: 'center' }}>
          Host yeni turu başlatana kadar bekle…
        </p>
      </div>
    </div>
  )
}

  // ── OYUN BİTTİ ──
  if (session.status === 'finished') {
  const { players: np, edges } = buildNetworkData(session, null)
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: 36, marginBottom: 6 }}>🎉</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Oyun bitti!</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>İşte sosyal ağınız</p>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="label" style={{ marginBottom: 12 }}>Network graph</p>
          <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
            <NetworkGraph players={np} edges={edges} width={480} height={380} />
          </div>
        </div>
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/')}>
          Ana sayfaya dön
        </button>
      </div>
    </div>
  )
}

  return null
}