import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchServerStatus } from '../lib/api'
import { getOnlineSinceKey } from '../lib/storage'
import { notifyServerOnline } from '../lib/notifications'

/**
 * Custom hook для мониторинга Minecraft сервера
 * Управляет polling, state, localStorage sync, уведомлениями
 */
export function useServerMonitor({ host, port, pollIntervalSec, apiSource, notifyOnOnline }) {
  const [server, setServer] = useState(null)
  const [onlineSince, setOnlineSince] = useState(null)
  const [sessions, setSessions] = useState({})
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState(null)

  const prevOnlineRef = useRef(false)
  const pollPrimedRef = useRef(false)
  const hostPort = `${host}:${port}`

  // Restore onlineSince from localStorage
  useEffect(() => {
    const since = localStorage.getItem(getOnlineSinceKey(hostPort))
    setOnlineSince(since ? Number(since) : null)
  }, [hostPort])

  // Polling logic
  useEffect(() => {
    let stop = false
    setIsPolling(true)
    setError(null)

    const tick = async () => {
      try {
        const data = await fetchServerStatus(
          import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
          host,
          port,
          apiSource
        )

        if (stop) return

        const isOnline = Boolean(data.online)
        setServer(data)
        setError(null)

        // Update onlineSince
        if (typeof data.onlineSince === 'number') {
          setOnlineSince(data.onlineSince)
          localStorage.setItem(getOnlineSinceKey(hostPort), String(data.onlineSince))
        } else {
          setOnlineSince(null)
          localStorage.removeItem(getOnlineSinceKey(hostPort))
        }

        // Notify on status change (offline → online)
        if (!pollPrimedRef.current) {
          pollPrimedRef.current = true
          prevOnlineRef.current = isOnline
        } else if (isOnline && !prevOnlineRef.current && notifyOnOnline) {
          notifyServerOnline(hostPort)
        }
        prevOnlineRef.current = isOnline

        // Update sessions (local tracking)
        if (isOnline) {
          const names = data?.players?.list || []
          setSessions((old) => {
            const next = { ...old }
            const now = Date.now()

            // Open sessions for new players
            for (const nick of names) {
              if (!next[nick] || !next[nick].length || next[nick][next[nick].length - 1].end) {
                next[nick] = [...(next[nick] || []), { start: now, end: null }]
              }
            }

            // Close sessions for players who left
            for (const nick of Object.keys(next)) {
              if (!names.includes(nick) && next[nick].length && !next[nick][next[nick].length - 1].end) {
                next[nick][next[nick].length - 1].end = now
              }
            }

            return next
          })
        }
      } catch (err) {
        if (!stop) {
          setError(err.message || 'Failed to fetch server status')
          setServer({
            online: false,
            players: { online: 0, max: 0, list: [], listHidden: false },
            ping: null,
            motd: { clean: 'No data' }
          })
        }
      }
    }

    tick()
    const intervalId = setInterval(tick, Math.max(5, pollIntervalSec) * 1000)

    return () => {
      stop = true
      clearInterval(intervalId)
      setIsPolling(false)
    }
  }, [host, port, pollIntervalSec, apiSource, notifyOnOnline, hostPort])

  const refetch = useCallback(() => {
    // Trigger immediate refetch by resetting pollPrimedRef
    pollPrimedRef.current = false
  }, [])

  return {
    server,
    onlineSince,
    sessions,
    isPolling,
    error,
    refetch
  }
}
