'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateRoundScores, updateDatasets, calculateAverageRanking, TOPIC_CATEGORIES, type Player } from '@/lib/gameEngine'
import type { GameSession } from '@/lib/db'
import QRDisplay from '@/components/QRDisplay'
import Avatar from '@/components/Avatar'
import styles from './host.module.css'
import { subscribeSession, startRound, endRound, finishGame, archiveSession, saveDatasets, getDatasets } from '@/lib/db'
import NetworkGraph, { buildNetworkData } from '@/components/NetworkGraph'

interface Props { params: { code: string } }

export default function HostPage({ params }: Props) {
  const { code } = params
  const router = useRouter()

  const [session, setSession]         = useState<GameSession | null>(null)
  const [topic, setTopic]             = useState(Object.keys(TOPIC_CATEGORIES)[0])
  const [loading, setLoading]         = useState(false)
  const [joinUrl, setJoinUrl]         = useState('')
  const [customIp, setCustomIp]       = useState('')
  const [showIpInput, setShowIpInput] = useState(false)
  const [datasets, setDatasets]       = useState<Record<string, any> | null>(null)
  const [showLabels, setShowLabels]   = useState(true)

  useEffect(() => {
    const origin = window.location.origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      setShowIpInput(true)
      const saved = localStorage.getItem('synergia_local_ip')
      if (saved) {
        setCustomIp(saved)
        setJoinUrl(`http://${saved}:3000/join/${code}`)
      }
    } else {
      setJoinUrl(`${origin}/join/${code}`)
    }
  }, [code])

  useEffect(() => {
    return subscribeSession(code, s => {
      if (!s) { router.push('/'); return }
      setSession(s)
    })
  }, [code, router])

  useEffect(() => {
    if (!session?.roundResults?.length) return
    getDatasets(code).then(setDatasets)
  }, [session?.roundResults?.length, code])

  if (!session) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  function applyIp(ip: string) {
    const clean = ip.trim()
    if (!clean) return
    localStorage.setItem('synergia_local_ip', clean)
    setCustomIp(clean)
    setJoinUrl(`http://${clean}:3000/join/${code}`)
  }

  const players   = Object.values(session.players || {}) as Player[]
  const votes     = session.votes || {}
  const voteCount = Object.keys(votes).length
  const allVoted  = players.length > 1 && voteCount >= players.length

  async function handleStartRound() {
    setLoading(true)
    await startRound(code, topic, (session!.currentRound || 0) + 1)
    setLoading(false)
  }

  async function handleEndRound() {
    setLoading(true)
    const existingDatasets = await getDatasets(code) || {}
    const roundIndex = (session!.currentRound || 1) - 1
    const updatedDatasets = updateDatasets(
      existingDatasets, players, votes, session!.currentTopic!, roundIndex
    )
    const result = calculateRoundScores(players, votes, session!.currentTopic!)
    await endRound(code, result)
    await saveDatasets(code, updatedDatasets)
    setLoading(false)
  }

  async function handleFinish() {
    await archiveSession(code)
    await finishGame(code)
    router.push(`/room/${code}`)
  }

  const totalScores: Record<string, number> = {}
  players.forEach(p => { totalScores[p.id] = 0 })
  ;(session.roundResults || []).forEach(r => {
    Object.entries(r.scores || {}).forEach(([id, pts]) => {
      totalScores[id] = (totalScores[id] || 0) + pts
    })
  })
  const sortedPlayers = [...players].sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0))
  const showRoundStarter = session.status === 'lobby' || session.status === 'round_ended'

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMark}>S</div>
          <div>
            <p className={styles.headerTitle}>Synergia</p>
            <p className={styles.headerSub}>Host paneli</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className="badge badge-muted mono">{code}</span>
          {session.status === 'lobby'        && <span className="badge badge-amber"><span className="dot dot-amber" />Lobi</span>}
          {session.status === 'round_active' && <span className="badge badge-green"><span className="dot dot-green" />Tur aktif</span>}
          {session.status === 'round_ended'  && <span className="badge badge-muted">Tur bitti</span>}
        </div>
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside}>
          <div className={`card ${styles.qrCard}`}>
            <p className="label">QR ile katıl</p>
            {showIpInput && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  Bilgisayarının IP'sini gir (ipconfig → IPv4):
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input mono"
                    style={{ fontSize: 13, padding: '6px 10px' }}
                    placeholder="örn. 172.21.162.117"
                    value={customIp}
                    onChange={e => setCustomIp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyIp(customIp)}
                  />
                  <button
                    className="btn btn-accent"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => applyIp(customIp)}
                  >
                    QR üret
                  </button>
                </div>
              </div>
            )}
            <div className={styles.qrWrap}>
              {joinUrl
                ? <QRDisplay value={joinUrl} size={180} />
                : <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                    <div className="spinner" />
                    <p style={{ fontSize: 12, color: 'var(--hint)' }}>IP gir ve QR üret</p>
                  </div>
              }
            </div>
            <p className={`mono ${styles.codeDisplay}`}>{code}</p>
            <p className={styles.qrHint}>{joinUrl || 'Yukarıya IP gir'}</p>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className={styles.playerHeader}>
              <p className="label">Oyuncular</p>
              <span className="badge badge-muted">{players.length}</span>
            </div>
            <div className={styles.playerList}>
              {players.length === 0 && (
                <p style={{ color: 'var(--hint)', fontSize: 13 }}>Henüz kimse katılmadı…</p>
              )}
              {players.map((p, i) => (
                <div key={p.id} className={styles.playerRow}>
                  <Avatar name={p.name} index={i} />
                  <span style={{ fontSize: 14 }}>{p.name}</span>
                  {votes[p.id]
                    ? <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Oyladı</span>
                    : <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--hint)' }}>Bekliyor</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          {showRoundStarter && (
            <div className={`card anim-fade-up ${styles.controlCard}`}>
              {session.status === 'round_ended' && (
                <>
                  <h2 className={styles.sectionTitle}>Tur bitti! 🎉</h2>
                  <p className="label" style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Güncel sıralama</p>
                  {sortedPlayers.map((p, i) => (
                    <div key={p.id} className={styles.scoreRow}>
                      <span className={styles.rank}>{i + 1}</span>
                      <Avatar name={p.name} index={players.indexOf(p)} size={30} />
                      <span style={{ fontSize: 14, flex: 1 }}>{p.name}</span>
                      <span className={`mono ${styles.scorePts}`}>{totalScores[p.id] || 0}</span>
                    </div>
                  ))}
                  {/* ← BURAYA EKLE */}
{(session.roundResults?.length ?? 0) > 0 && (() => {
  const lastResult = session.roundResults![session.roundResults!.length - 1]
  const lastVotes = session.votes || {}
  const lastRanking = calculateAverageRanking(players, lastVotes)
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return (
    <>
      <div className="sep" />
      <p className="label" style={{ marginBottom: '0.5rem' }}>
        Son tur · {lastResult.topic}
      </p>
      {lastRanking.map(({ playerId, avgRank, displayRank }) => {
        const p = players.find(x => x.id === playerId)
        if (!p) return null
        return (
          <div key={playerId} className={styles.scoreRow}>
            <span className={styles.rank}>{medals[displayRank] || `${displayRank}.`}</span>
            <Avatar name={p.name} index={players.indexOf(p)} size={26} />
            <span style={{ fontSize: 13, flex: 1 }}>{p.name}</span>
            <span className={`mono ${styles.scorePts}`} style={{ fontSize: 12, color: 'var(--muted)' }}>
              ⌀ {avgRank.toFixed(1)}
            </span>
          </div>
        )
      })}
    </>
  )
})()}

<div className="sep" />  {/* ← MEVCUT SEP */}
                  <div className="sep" />
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: '1.25rem' }}>
                    Yeni tur için tema seç:
                  </p>
                </>
              )}

              {session.status === 'lobby' && (
                <>
                  <h2 className={styles.sectionTitle}>Turu başlat</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: '1.25rem' }}>
                    Tema seç ve oyuncular bağlandıktan sonra turu başlat.
                  </p>
                </>
              )}

              <div className={styles.topicGrid}>
                {Object.keys(TOPIC_CATEGORIES).map(t => (
                  <button
                    key={t}
                    className={`${styles.topicBtn} ${topic === t ? styles.topicActive : ''}`}
                    onClick={() => setTopic(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="sep" />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-accent"
                  style={{ flex: 1, justifyContent: 'center', padding: '13px' }}
                  onClick={handleStartRound}
                  disabled={players.length < 2 || loading}
                >
                  {loading ? <span className="spinner" /> : null}
                  {players.length < 2 ? 'En az 2 oyuncu gerek' : `"${topic}" turunu başlat`}
                </button>
                {session.status === 'round_ended' && (
                  <button
                    className="btn btn-danger"
                    style={{ justifyContent: 'center', padding: '13px' }}
                    onClick={handleFinish}
                  >
                    Oyunu bitir
                  </button>
                )}
              </div>
            </div>
          )}

          {session.status === 'round_active' && (
            <div className={`card anim-fade-up ${styles.controlCard}`}>
              <div className={styles.activeHeader}>
                <span className="badge badge-green"><span className="dot dot-green" />Aktif</span>
                <h2 className={styles.activeTopic}>{session.currentTopic}</h2>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
                Tur {session.currentRound}
              </p>
              <p className="label" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Oylamalar — {voteCount} / {players.length}
              </p>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: players.length ? `${(voteCount / players.length) * 100}%` : '0%' }}
                />
              </div>
              {allVoted && (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)' }}>
                  ✓ Tüm oyuncular oyladı!
                </p>
              )}
              <div className="sep" />
              <button
                className="btn btn-accent"
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
                onClick={handleEndRound}
                disabled={!allVoted || loading}
              >
                {loading ? <span className="spinner" /> : null}
                Turu bitir ve sonuçları gör
              </button>
            </div>
          )}

          {/* Network Graph */}
          {(session.roundResults?.length ?? 0) > 0 && (() => {
            const { players: np, edges } = buildNetworkData(session, datasets)
            return (
              <div className="card anim-fade-up" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <p className="label">
                    Network graph · {session.roundResults?.length} tur
                  </p>
                  <button
                    className="btn"
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 8 }}
                    onClick={() => setShowLabels(v => !v)}
                  >
                    {showLabels ? '🏷️ İsimleri gizle' : '🏷️ İsimleri göster'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <NetworkGraph players={np} edges={edges} width={520} height={420} showLabels={showLabels} />
                </div>
              </div>
            )
          })()}
        </main>
      </div>
    </div>
  )
}
