# Проверка Motion Drive — 2026-11-09

Проверялась локальная производственная сборка Next.js 16.4.5 на Node.js 24.22.1. Сервер `npm start`, Chromium через Playwright. Публичного деплоя и платных AI-вызовов не было.

| Проверка | Результат |
|---|---|
| `npm run build` | Пройдено: webpack, проверка TypeScript, генерация robots/sitemap |
| `npm run typecheck` | Пройдено |
| `npm test` | Пройдено: тестовый файл схем, согласий, словарей и маскирования |
| Четыре языка | Отдельные URL, lang, заголовки, интерфейс и словари ka/hy/ru/en открываются |
| Все локализованные страницы | 72 страницы / 4 языка — HTTP 200; переполнение исправлено. Главная дополнительно проверена на 320, 360, 768, 1024, 1440 px |
| Мобильный сценарий 390×844 | Меню, чат, регистрация, запись и отмена прошли; горизонтального переполнения нет |
| Регистрация → API → SQLite → кабинет | Пройдено через реальную форму |
| Заявка → сохранение → кабинет → отмена | Пройдено через реальный интерфейс; статус отмены сохранён |
| Админка | Ученик не получает доступ; отдельный временный admin изменил FAQ через форму, ответ появился в публичном разделе |
| Загрузка медиа | JPEG загружен через админку, сохранены файл и запись CMS; черновик не доступен посетителям |
| Серверные роли | Запрет гостю создавать заявку, ученику менять контент/расписание, чужому ученику отменять заявку |
| Расписание | Пересечение слотов одного инструктора отклонено; чужой инструктор не меняет доступность |
| Двойное бронирование | Второй запрос на занятый слот получает 409; отмена освобождает слот |
| Подтверждение | Без назначенного времени заявка не может стать confirmed |
| Изоляция инструктора | Чужие бронирования не выдаются в dashboard |
| Учебный движок | Без банка — явное сообщение. Временный тестовый вопрос: правильный ответ скрыт до отправки, оценка сохранена, повторная отправка отклонена. Вопрос удалён |
| FAQ-консультант | Утверждённый точный ответ; неизвестный вопрос — fallback и передача школе; платный API не используется |
| Ответ администратора в чате | Ответ сохраняется администратором, выдаётся владельцу диалога; чужой пользователь историю не получает |
| Импорт | Контакт замаскирован, два одинаковых вопроса сгруппированы с частотой 2; только черновик |
| CSRF | Запрос с посторонним Origin отклонён |
| Reduced motion | Автопрокрутка отключена; настройки Motion/CSS учитывают предпочтение |
| JavaScript в итоговом сценарии | `errors: []` в browser-report и admin-browser-report |

Машиночитаемые доказательства: `docs/verification/api-report.json`, `browser-report.json`, `admin-browser-report.json`, `responsive-report.json`. Снимки главной, чата и административного кабинета находятся рядом. На снимках админки могут быть явно тестовые данные из проверки — в текущей БД они удалены.

## Ограничения проверки

- Chromium mobile emulation, не физические iPhone/Android/Safari. На реальных устройствах ещё не проверялось.
- Не заявляем Lighthouse-баллы или производительность реального хостинга: метрики не измерялись. Локальные изображения ~340 КБ и ~243 КБ, шрифты self-hosted; видео без файлов не загружается.
- Платная Responses API ветка намеренно не вызывалась; ключ и утверждённая модель отсутствуют. Бюджетные блокировки требуют отдельного интеграционного теста после разрешения владельца.
- Meta, email/SMS, recovery, PostgreSQL и внешнее хранилище не подключались.
- Переводы и юридические тексты не прошли проверку носителями/владельцем.
- Учебная база пустая. Тестовая fixture не была грузинским экзаменационным материалом и удалена после теста.
- Текущая версия не является аудитом безопасности для публичного запуска. Известные эксплуатационные ограничения перечислены в ARCHITECTURE.md.

## GitHub / Vercel release — 2026-11-09

Production-mode local verification (`VERCEL=1`, Node 24):
- `npm run typecheck`, `npm test`, `npm run build`: passed.
- Chromium: ru/ka/hy/en render with correct document language and school phone links.
- Responsive checks: 320, 390 and 768 px, no horizontal overflow; mobile menu opens/closes.
- Booking page: both branch phones present, no data-collection form.
- `/api/me`: `{user:null}`. Registration POST: 503, personal data not accepted.
- Browser JavaScript errors: none.
- Screenshots: `deploy-desktop.png`, `deploy-mobile.png` in this directory.
- Public site remains noindex; online accounts/booking/chat need durable storage before activation.

## Online calendar, operator and chatbot — 2026-11-09

- PostgreSQL migration/query/constraint tests run against PGlite: slot uniqueness,
  cancellation/reuse, parameter binding and atomic rate-limit upsert pass. Anonymous
  database roles cannot access the private schema; the app role cannot alter tables.
- Isolated local API flow (`scripts/online-check.py`): student registration cannot
  choose a role; operators cannot grant roles; schedule splitting/overlap validation,
  simultaneous double-booking (one winner), booked-slot closure protection,
  rescheduling, cancellation/release, confirmation and student data isolation pass.
- FAQ retrieval, unknown-question handoff, operator reply and chat history isolation
  pass. Cross-origin mutations are rejected.
- Chromium (`scripts/online-browser-check.py`): mobile day/time picker, real booking
  submission, account date rendering, operator calendar and sourced chatbot pass;
  no JavaScript errors or horizontal overflow on tested pages.
- New screenshots are isolated test data, not production bookings:
  `online-calendar-mobile.png`, `online-operator-desktop.png`.
- Production PostgreSQL persistence and real media upload remain unverified until
  the database placement decision is approved; see DEPLOYMENT.md.
