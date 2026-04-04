export const I18N = {
  ru: {
    appTitle: 'Minecraft Server Monitor',
    settingsButton: 'Настройки',
    tabs: { dashboard: 'Главная', stats: 'Статистика', chat: 'Чат', map: 'Карта', settings: 'Настройки' },
    mapReserved: 'Зарезервировано для интеграции BlueMap/Dynmap.',
    server: {
      online: 'Online',
      offline: 'Offline',
      subtitleFallback: 'Мониторинг Minecraft-сервера',
      players: 'Игроки',
      ping: 'Пинг',
      uptime: 'Uptime',
      playersOnline: 'Игроки онлайн',
      noPlayers: 'Сейчас игроков нет'
    },
    settings: {
      title: 'Настройки',
      serverAddress: 'Адрес сервера',
      pollInterval: 'Интервал обновления',
      apiSource: 'Источник API',
      notifyOnline: 'Уведомления при онлайне',
      darkTheme: 'Тёмная тема',
      language: 'Язык',
      requestNotifications: 'Запросить уведомления'
    },
    stats: {
      title: 'Статистика',
      onlinePlayers: 'Онлайн игроков',
      peak: 'Пик онлайна',
      offlines: 'Краши/оффлайны',
      avgUptime: 'Средний uptime'
    },
    chat: {
      title: 'Чат',
      subtitle: 'Глобальный realtime-чат',
      signedInAs: 'Вошли как',
      logout: 'Выйти',
      oauthNotConfigured: 'OAuth не настроен. Демо-режим.',
      signInPrompt: 'Войдите через ely.by для привязки ника',
      loginEly: 'Войти через ely.by',
      messagePlaceholder: 'Сообщение...',
      send: 'Отправить',
      empty: 'Пока нет сообщений'
    },
    player: {
      currentSession: 'Текущая сессия',
      sessionHistory: 'История сессий',
      noLocalHistory: 'Локальной истории пока нет',
      now: 'сейчас',
      discordReserved: 'Discord статус: зарезервировано'
    }
  },
  en: {
    appTitle: 'Minecraft Server Monitor',
    settingsButton: 'Settings',
    tabs: { dashboard: 'Dashboard', stats: 'Stats', chat: 'Chat', map: 'Map', settings: 'Settings' },
    mapReserved: 'Reserved for BlueMap/Dynmap integration.',
    server: {
      online: 'Online',
      offline: 'Offline',
      subtitleFallback: 'Minecraft server monitor',
      players: 'Players',
      ping: 'Ping',
      uptime: 'Uptime',
      playersOnline: 'Players online',
      noPlayers: 'No players online'
    },
    settings: {
      title: 'Settings',
      serverAddress: 'Server address',
      pollInterval: 'Poll interval',
      apiSource: 'API source',
      notifyOnline: 'Online notifications',
      darkTheme: 'Dark theme',
      language: 'Language',
      requestNotifications: 'Request notifications'
    },
    stats: {
      title: 'Statistics',
      onlinePlayers: 'Online players',
      peak: 'Peak online',
      offlines: 'Crashes/offlines',
      avgUptime: 'Avg uptime'
    },
    chat: {
      title: 'Chat',
      subtitle: 'Global realtime chat',
      signedInAs: 'Signed in as',
      logout: 'Logout',
      oauthNotConfigured: 'OAuth is not configured. Demo mode enabled.',
      signInPrompt: 'Sign in via ely.by to link your nickname',
      loginEly: 'Login via ely.by',
      messagePlaceholder: 'Message...',
      send: 'Send',
      empty: 'No messages yet'
    },
    player: {
      currentSession: 'Current session',
      sessionHistory: 'Session history',
      noLocalHistory: 'No local history yet',
      now: 'now',
      discordReserved: 'Discord status: reserved'
    }
  }
}

export function getT(lang) {
  return I18N[lang] || I18N.en
}
