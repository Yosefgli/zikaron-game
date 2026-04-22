export const he = {
  // Home
  game_title:       'משחק זיכרון',
  create_room:      'צור חדר',
  join_room:        'הצטרף לחדר',
  your_name:        'השם שלך',
  room_code:        'קוד חדר',
  enter_name:       'הכנס שם...',
  enter_code:       'הכנס קוד חדר...',
  loading:          'טוען...',

  // Lobby
  waiting_for_players: 'ממתין לשחקנים...',
  start_game:          'התחל משחק',
  share_code:          'שתף קוד:',
  players_in_room:     'שחקנים בחדר',
  you:                 '(אתה)',
  host:                'מנהל',

  // Settings
  settings:              'הגדרות',
  pair_found_behavior:   'כשנמצא זוג',
  stay_open:             'נשאר גלוי',
  remove_from_board:     'הסר מהלוח',
  miss_reveal_ms:        'זמן הצגת שגיאה (מ"ש)',
  turn_timer:            'טיימר תור',
  turn_time_limit:       'מגבלת זמן (שניות)',
  language:              'שפה',
  card_set:              'סט קלפים',
  num_pairs:             'מספר זוגות',
  save_settings:         'שמור הגדרות',
  select_set:            'בחר סט...',

  // In-game
  your_turn:       'זה התור שלך!',
  waiting_turn:    (name: string) => `תור של ${name}`,
  match_found:     'נמצא זוג!',
  miss:            'לא התאים!',
  board_locked:    'ממתין...',
  score:           'ניקוד',
  skip_turn:       'דלג על תור',
  game_over:       'המשחק הסתיים!',
  winner:          (name: string) => `${name} ניצח!`,
  final_scores:    'ניקוד סופי',
  play_again:      'שחק שוב',

  // Errors
  room_not_found:  'חדר לא נמצא',
  game_started:    'המשחק כבר התחיל',
  not_your_turn:   'לא התור שלך',
  board_locked_err:'הלוח נעול',
  error_generic:   'אירעה שגיאה',
} as const
