'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSession, getSession } from '@/lib/db'
import { generateRoomCode } from '@/lib/gameEngine'
import styles from './page.module.css'

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleHost() {
    setLoading(true)
    const code = generateRoomCode()
    const hostId = `host_${Date.now()}`
    await createSession(code, hostId)
    // hostId'yi localStorage'a kaydet (basit auth)
    localStorage.setItem('synergia_host_id', hostId)
    localStorage.setItem('synergia_room', code)
    router.push(`/host/${code}`)
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code || code.length < 4) { setError('Geçerli bir oda kodu gir'); return }
    setLoading(true)
    const session = await getSession(code)
    if (!session) { setError('Oda bulunamadı. Kodu kontrol et.'); setLoading(false); return }
    if (session.status === 'finished') { setError('Bu oyun zaten bitti.'); setLoading(false); return }
    router.push(`/join/${code}`)
  }

  return (
    <main className={styles.root}>
      <div className={styles.noise} aria-hidden />

      <div className={styles.hero}>
        <div className={`${styles.logoBadge} anim-fade-up`}>
          <span className={styles.logoMark}>S</span>
        </div>
        <h1 className={`${styles.title} anim-fade-up anim-delay-1`}>
          Synergia
        </h1>
        <p className={`${styles.sub} anim-fade-up anim-delay-2`}>
          Arkadaşlarını sırala. Sosyal ağını keşfet.
        </p>
      </div>

      <div className={`${styles.actions} anim-fade-up anim-delay-3`}>
        <button className={`btn btn-accent ${styles.hostBtn}`} onClick={handleHost} disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          Oyun başlat
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={styles.divider}><span>ya da</span></div>

        <div className={styles.joinRow}>
          <input
            className={`input mono ${styles.codeInput}`}
            placeholder="ODA KODU"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={8}
          />
          <button className="btn" onClick={handleJoin} disabled={loading || !joinCode}>
            Katıl
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <p className={styles.footer}>5–10 oyuncu · Gerçek zamanlı · QR ile katıl</p>
    </main>
  )
}
