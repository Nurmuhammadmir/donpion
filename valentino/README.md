# Valentino

Бренд-клон [DonPion](../README.md) — тот же код и архитектура (Node/Express
+ MongoDB, Next.js, Vite-админка), полностью независимый деплой. Архитектура,
эндпоинты и принципы работы подробно описаны в [корневом README.md](../README.md)
— здесь только то, что отличается.

## Запуск локально

```bash
cd valentino/server
npm install
npm run dev        # http://localhost:4200

cd valentino/client
npm install
npm run dev        # http://localhost:3001

cd valentino/admin
npm install
npm run dev         # http://localhost:5174
```

`.env` / `.env.local` уже на месте (не в git — см. `.env.example` в каждой
папке за описанием переменных). `MONGODB_URI` смотрит на `valentino-shop` —
для локальной разработки нужен тот же SSH-туннель на VPS-Mongo, что и для
DonPion (`ssh -L 27017:127.0.0.1:27017 root@<vps>`).

## Отличия от DonPion

- Порты 4200/3001/5174 вместо 4100/3000/5173 — чтобы оба бренда могли
  работать одновременно, локально и на VPS.
- Палитра тиффани + белый вместо бежевого/hermes-оранжевого — см.
  `tailwind.config.ts` в `client/` и `admin/`.
- Логотип (`client/public/nav-logo.png`, `client/src/app/icon.png`,
  `admin/public/favicon.png`) — временный текстовый вордмарк, сгенерированный
  как плейсхолдер. Замени на настоящий лого-файл по тем же путям, когда он
  будет готов.
- Список мест, где остались явные плейсхолдеры (телеграм-бот, соцсети,
  email, телефон, домен, GA) — см. [AGENTS.md](AGENTS.md).
