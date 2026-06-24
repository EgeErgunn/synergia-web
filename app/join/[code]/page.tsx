'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, joinSession } from '@/lib/db'
import styles from './join.module.css'

interface Props { params: { code: string } }

export default function JoinPage({ params }: Props) {
  const { code } = params
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionValid, setSessionValid] = useState<boolean | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(`synergia_player_${code}`)
    if (saved) { router.replace(`/room/${code}`); return }
    getSession(code).then(s => setSessionValid(!!s))
  }, [code, router])

  async function handleJoin() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Adını gir'); return }
    if (trimmed.length > 20) { setError('İsim en fazla 20 karakter'); return }

    setLoading(true)
    const session = await getSession(code)
    if (!session) { setError('Oda bulunamadı'); setLoading(false); return }
    if (session.status === 'finished') { setError('Bu oyun zaten bitti'); setLoading(false); return }

    const players = Object.values(session.players || {})
    if (players.find((p: any) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Bu isim alınmış, başkasını dene'); setLoading(false); return
    }
    if (players.length >= 10) { setError('Oda dolu (max 10 oyuncu)'); setLoading(false); return }

    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const player = { id: playerId, name: trimmed, joinedAt: Date.now() }
    await joinSession(code, player)
    localStorage.setItem(`synergia_player_${code}`, JSON.stringify(player))
    router.push(`/room/${code}`)
  }

  if (sessionValid === null) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (sessionValid === false) {
    return (
      <div className={styles.root}>
        <div className={styles.notFound}>
          <p className={styles.notFoundEmoji}>🤔</p>
          <h2 className={styles.notFoundTitle}>Oda bulunamadı</h2>
          <p className={styles.notFoundSub}>
            Kod <span className="mono" style={{ color: 'var(--accent)' }}>{code}</span> geçersiz veya süresi dolmuş.
          </p>
          <button className="btn btn-accent" onClick={() => router.push('/')}>
            Ana sayfaya dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Arka plan dekor */}
      <div className={styles.bgOrb1} aria-hidden />
      <div className={styles.bgOrb2} aria-hidden />

      <div className={`anim-fade-up ${styles.card}`}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>S</div>
          <div className={styles.logoText}>
            <p className={styles.logoTitle}>Synergia</p>
            <p className={styles.logoSub}>
              Oda: <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{code}</span>
            </p>
          </div>
        </div>

        <div className={styles.divider} />

        <h1 className={styles.title}>Nasıl çağrılmak istersin?</h1>
        <p className={styles.sub}>
          Diğer oyuncular seni bu isimle görecek.
        </p>

        <div className={styles.inputWrap}>
          <input
            className={`input ${styles.nameInput}`}
            placeholder="Adını yaz…"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={20}
            autoFocus
          />
          {name && (
            <div className={styles.charCount}>{name.length}/20</div>
          )}
        </div>

        {error && (
          <div className={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        <button
          className={`btn btn-accent ${styles.joinBtn}`}
          onClick={handleJoin}
          disabled={loading || !name.trim()}
        >
          {loading
            ? <span className="spinner" />
            : <>Oyuna gir <span className={styles.arrow}>→</span></>
          }
        </button>
      </div>
    </div>
  )
}
