'use client'
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRProps {
  value: string
  size?: number
}

export default function QRDisplay({ value, size = 200 }: QRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#c8f060',   // accent yeşil
        light: '#111111',  // surface arka plan
      },
    })
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: 12, display: 'block' }}
    />
  )
}
