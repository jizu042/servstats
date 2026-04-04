export const I18N = {
  ru: {
    appTitle: 'Minecraft Server Monitor',
    tabs: { dashboard: 'Главная', stats: 'Статистика', chat: 'Чат', map: 'Карта' },
    mapReserved: 'Зарезервировано для интеграции BlueMap/Dynmap.',
    auth: {
      signedInSuccess: 'Вход выполнен.',
      signedOut: 'Вы вышли из аккаунта.',
      errors: {
        missing_code: 'OAuth: код авторизации не получен.',
        oauth_not_configured: 'Вход через ely.by не настроен на сервере.',
        invalid_state: 'Сессия OAuth устарела. Попробуйте войти снова.',
        token_exchange: 'Не удалось обменять код на токен (ely.by).',
        userinfo: 'Не удалось получить профиль с ely.by.',
        missing_username: 'В ответе ely.by нет имени пользователя.',
        callback_failed: 'Ошибка обработки OAuth.',
        unknown: 'Ошибка входа.'
      }
    },
    server: {
      online: 'Online',
      offline: 'Offline',
      subtitleFallback: 'Мониторинг Minecraft-сервера',
      players: 'Игроки',
      ping: 'Пинг',
      uptime: 'Uptime',
      playersOnline: 'Игроки онлайн',
      noPlayers: 'Сейчас игроков нет',
      listHidden: 'Сервер не публикует список игроков (онлайн скрыт).',
      recentSeenTitle: 'Недавно видели',
      recentSeenBadge: 'Локально',
      recentSeenHint: 'По данным этого браузера для выбранного сервера.'
    },
    settings: {
      title: 'Настройки',
      serverAddress: 'Адрес сервера',
      pollInterval: 'Интервал обновления',
      apiSource: 'Источник API',
      notifyOnline: 'Уведомления при онлайне',
      darkTheme: 'Тёмная тема',
      language: 'Язык',
      requestNotifications: 'Запросить уведомления',
      openSettings: 'Открыть настройки'
    },
    stats: {
      title: 'Статистика',
      onlinePlayers: 'Онлайн игроков',
      peak: 'Пик онлайна',
      offlines: 'Краши/оффлайны',
      avgUptime: 'Средний uptime',
      loading: 'Загрузка…',
      empty: 'Нет выборки за этот период для этого сервера (нужна БД и сборщик).',
      emptyShort: 'Нет данных для графика.'
    },
    chat: {
      title: 'Чат',
      signedInAs: 'Вошли как',
      logout: 'Выйти',
      oauthNotConfigured: 'OAuth не настроен. Демо-режим.',
      signInPrompt: 'Войдите через ely.by для привязки ника',
      loginEly: 'Войти через ely.by',
      messagePlaceholder: 'Сообщение...',
      send: 'Отправить',
      systemWelcome: 'Локальный чат подключён.',
      loadingHistory: 'Загрузка истории…',
      loadHistoryError: 'Не удалось загрузить историю.',
      retry: 'Повторить',
      streamLive: 'Соединение активно',
      streamReconnecting: 'Переподключение…',
      streamError: 'Поток сообщений прерван',
      sendFailed: 'Не удалось отправить сообщение.',
      emptyChat: 'Пока нет сообщений.'
    },
    player: {
      currentSession: 'Текущая сессия',
      sessionHistory: 'История сессий',
      noLocalHistory: 'Локальной истории пока нет',
      now: 'сейчас',
      discordReserved: 'Discord статус: зарезервировано',
      skinLoadError: 'Не удалось загрузить скин (показан запасной вариант).'
    }
  },
  en: {
    appTitle: 'Minecraft Server Monitor',
    tabs: { dashboard: 'Dashboard', stats: 'Stats', chat: 'Chat', map: 'Map' },
    mapReserved: 'Reserved for BlueMap/Dynmap integration.',
    auth: {
      signedInSuccess: 'Signed in successfully.',
      signedOut: 'You have been signed out.',
      errors: {
        missing_code: 'OAuth: authorization code missing.',
        oauth_not_configured: 'ely.by login is not configured on the server.',
        invalid_state: 'OAuth session expired. Try signing in again.',
        token_exchange: 'Could not exchange code for token (ely.by).',
        userinfo: 'Could not load profile from ely.by.',
        missing_username: 'ely.by response had no username.',
        callback_failed: 'OAuth callback failed.',
        unknown: 'Sign-in error.'
      }
    },
    server: {
      online: 'Online',
      offline: 'Offline',
      subtitleFallback: 'Minecraft server monitor',
      players: 'Players',
      ping: 'Ping',
      uptime: 'Uptime',
      playersOnline: 'Players online',
      noPlayers: 'No players online',
      listHidden: 'This server does not publish the player list (online hidden).',
      recentSeenTitle: 'Recently seen',
      recentSeenBadge: 'Local',
      recentSeenHint: 'From this browser for the selected server.'
    },
    settings: {
      title: 'Settings',
      serverAddress: 'Server address',
      pollInterval: 'Poll interval',
      apiSource: 'API source',
      notifyOnline: 'Online notifications',
      darkTheme: 'Dark theme',
      language: 'Language',
      requestNotifications: 'Request notifications',
      openSettings: 'Open settings'
    },
    stats: {
      title: 'Statistics',
      onlinePlayers: 'Online players',
      peak: 'Peak online',
      offlines: 'Crashes/offlines',
      avgUptime: 'Avg uptime',
      loading: 'Loading…',
      empty: 'No samples for this period on this server (needs DB + collector).',
      emptyShort: 'No chart data.'
    },
    chat: {
      title: 'Chat',
      signedInAs: 'Signed in as',
      logout: 'Logout',
      oauthNotConfigured: 'OAuth is not configured. Demo mode enabled.',
      signInPrompt: 'Sign in via ely.by to link your nickname',
      loginEly: 'Login via ely.by',
      messagePlaceholder: 'Message...',
      send: 'Send',
      systemWelcome: 'Local chat connected.',
      loadingHistory: 'Loading history…',
      loadHistoryError: 'Could not load chat history.',
      retry: 'Retry',
      streamLive: 'Stream connected',
      streamReconnecting: 'Reconnecting…',
      streamError: 'Message stream interrupted',
      sendFailed: 'Could not send message.',
      emptyChat: 'No messages yet.'
    },
    player: {
      currentSession: 'Current session',
      sessionHistory: 'Session history',
      noLocalHistory: 'No local history yet',
      now: 'now',
      discordReserved: 'Discord status: reserved',
      skinLoadError: 'Could not load skin (showing fallback).'
    }
  }
}

export function getT(lang) {
  return I18N[lang] || I18N.en
}
