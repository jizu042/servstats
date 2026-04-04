export const I18N = {
  ru: {
    appTitle: 'MC Monitor',
    tabs: {
      dashboard: 'Главная',
      stats:     'Статистика',
      chat:      'Чат',
      details:   'Подробности',
      map:       'Карта'
    },
    mapReserved: 'Зарезервировано для интеграции BlueMap/Dynmap.',
    auth: {
      signedInSuccess: 'Вход выполнен.',
      signedOut: 'Вы вышли из аккаунта.',
      logout: 'Выйти',
      errors: {
        missing_code:         'OAuth: код авторизации не получен.',
        oauth_not_configured: 'Вход через ely.by не настроен на сервере.',
        invalid_state:        'Сессия OAuth устарела. Попробуйте войти снова.',
        token_exchange:       'Не удалось обменять код на токен (ely.by).',
        userinfo:             'Не удалось получить профиль с ely.by.',
        missing_username:     'В ответе ely.by нет имени пользователя.',
        callback_failed:      'Ошибка обработки OAuth.',
        unknown:              'Ошибка входа.'
      }
    },
    server: {
      online:           'Online',
      offline:          'Offline',
      subtitleFallback: 'Мониторинг Minecraft-сервера',
      players:          'Игроки',
      ping:             'Пинг',
      uptime:           'Аптайм',
      playersOnline:    'Игроки онлайн',
      noPlayers:        'Сейчас игроков нет',
      listHidden:       'Сервер не публикует список игроков.',
      recentSeenTitle:  'Недавно видели',
      recentSeenBadge:  'Локально',
      recentSeenHint:   'По данным этого браузера для выбранного сервера.'
    },
    settings: {
      title:                'Настройки',
      serverAddress:        'Адрес сервера',
      pollInterval:         'Интервал обновления',
      apiSource:            'Источник API',
      notifyOnline:         'Уведомления при онлайне',
      darkTheme:            'Тёмная тема',
      language:             'Язык',
      requestNotifications: 'Запросить уведомления',
      openSettings:         'Настройки',
      logout:               'Выйти'
    },
    stats: {
      title:          'Статистика',
      onlinePlayers:  'Онлайн игроков',
      peak:           'Пик онлайна',
      offlines:       'Краши / оффлайны',
      avgUptime:      'Средний uptime',
      loading:        'Загрузка…',
      empty:          'Нет данных за этот период (нужны БД и коллектор).',
      emptyShort:     'Нет данных.',
      playersHistory: 'История игроков'
    },
    chat: {
      title:               'Чат',
      signedInAs:          'Вошли как',
      logout:              'Выйти',
      oauthNotConfigured:  'OAuth не настроен. Демо-режим.',
      signInPrompt:        'Войдите через ely.by чтобы писать в чат',
      loginEly:            'Войти через Ely.by',
      messagePlaceholder:  'Напишите сообщение…',
      send:                'Отправить',
      systemWelcome:       'Локальный чат подключён.',
      loadingHistory:      'Загрузка истории…',
      loadHistoryError:    'Не удалось загрузить историю.',
      retry:               'Повторить',
      streamLive:          '● Подключено',
      streamReconnecting:  '↻ Переподключение…',
      streamError:         '✕ Поток прерван',
      sendFailed:          'Не удалось отправить сообщение.',
      emptyChat:           'Пока нет сообщений.'
    },
    player: {
      currentSession:  'Текущая сессия',
      sessionHistory:  'История сессий',
      noLocalHistory:  'Истории пока нет',
      now:             'сейчас',
      discordReserved: 'Discord статус: зарезервировано',
      skinLoadError:   'Не удалось загрузить скин (показан запасной вариант).'
    },
    details: {
      title:       'Подробности',
      subtitle:    'Агрегированные данные из внешних источников',
      refresh:     'Обновить',
      noData:      'Нет данных',
      summary:     'Сводка',
      loading:     'Загрузка…',
      errorPrefix: 'Ошибка загрузки'
    }
  },

  en: {
    appTitle: 'MC Monitor',
    tabs: {
      dashboard: 'Dashboard',
      stats:     'Statistics',
      chat:      'Chat',
      details:   'Details',
      map:       'Map'
    },
    mapReserved: 'Reserved for BlueMap/Dynmap integration.',
    auth: {
      signedInSuccess: 'Signed in successfully.',
      signedOut: 'You have been signed out.',
      logout: 'Logout',
      errors: {
        missing_code:         'OAuth: authorization code missing.',
        oauth_not_configured: 'ely.by login is not configured on the server.',
        invalid_state:        'OAuth session expired. Try signing in again.',
        token_exchange:       'Could not exchange code for token (ely.by).',
        userinfo:             'Could not load profile from ely.by.',
        missing_username:     'ely.by response had no username.',
        callback_failed:      'OAuth callback failed.',
        unknown:              'Sign-in error.'
      }
    },
    server: {
      online:           'Online',
      offline:          'Offline',
      subtitleFallback: 'Minecraft server monitor',
      players:          'Players',
      ping:             'Ping',
      uptime:           'Uptime',
      playersOnline:    'Players online',
      noPlayers:        'No players online',
      listHidden:       'This server does not publish the player list.',
      recentSeenTitle:  'Recently seen',
      recentSeenBadge:  'Local',
      recentSeenHint:   'From this browser for the selected server.'
    },
    settings: {
      title:                'Settings',
      serverAddress:        'Server address',
      pollInterval:         'Poll interval',
      apiSource:            'API source',
      notifyOnline:         'Online notifications',
      darkTheme:            'Dark theme',
      language:             'Language',
      requestNotifications: 'Request notifications',
      openSettings:         'Settings',
      logout:               'Logout'
    },
    stats: {
      title:          'Statistics',
      onlinePlayers:  'Online players',
      peak:           'Peak online',
      offlines:       'Crashes / offlines',
      avgUptime:      'Avg uptime',
      loading:        'Loading…',
      empty:          'No samples for this period (needs DB + collector).',
      emptyShort:     'No chart data.',
      playersHistory: 'Player history'
    },
    chat: {
      title:               'Chat',
      signedInAs:          'Signed in as',
      logout:              'Logout',
      oauthNotConfigured:  'OAuth is not configured. Demo mode.',
      signInPrompt:        'Sign in via ely.by to send messages',
      loginEly:            'Login via Ely.by',
      messagePlaceholder:  'Write a message…',
      send:                'Send',
      systemWelcome:       'Local chat connected.',
      loadingHistory:      'Loading history…',
      loadHistoryError:    'Could not load chat history.',
      retry:               'Retry',
      streamLive:          '● Connected',
      streamReconnecting:  '↻ Reconnecting…',
      streamError:         '✕ Stream interrupted',
      sendFailed:          'Could not send message.',
      emptyChat:           'No messages yet.'
    },
    player: {
      currentSession:  'Current session',
      sessionHistory:  'Session history',
      noLocalHistory:  'No history yet',
      now:             'now',
      discordReserved: 'Discord status: reserved',
      skinLoadError:   'Could not load skin (showing fallback).'
    },
    details: {
      title:       'Details',
      subtitle:    'Aggregated data from external sources',
      refresh:     'Refresh',
      noData:      'No data',
      summary:     'Summary',
      loading:     'Loading…',
      errorPrefix: 'Load error'
    }
  }
}

export function getT(lang) {
  return I18N[lang] || I18N.en
}
