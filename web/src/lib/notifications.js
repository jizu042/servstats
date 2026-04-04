export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function notifyServerOnline(hostPort) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification('Minecraft Server Online', {
    body: `${hostPort} снова в сети`,
    icon: '/favicon.ico'
  })
}
