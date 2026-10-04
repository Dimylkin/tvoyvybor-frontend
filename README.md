# ТвойВыбор.exe — frontend и локальный запуск

Этот репозиторий содержит React/TypeScript приложение и Docker Compose. Этап 4 добавляет вход, регистрацию, хаб, профиль и промежуточные результаты. Игровая сцена и прохождение заданий появятся на этапе 5 roadmap.

## Запуск

Положите репозитории рядом в одной директории:

```text
Code/
├── tvoyvybor-backend/
└── tvoyvybor-frontend/
```

Нужны Docker и Docker Compose. Из `tvoyvybor-frontend` выполните:

```sh
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Frontend доступен на <http://localhost:5173>, backend — на <http://localhost:8000>, healthcheck — <http://localhost:8000/health>. PostgreSQL доступен backend-контейнеру по имени `db`; данные сохраняются в Docker volume `postgres_data`.
Перед стартом backend Compose применяет миграции Alembic.
Браузер обращается к backend через `/api`: Vite перенаправляет эти запросы на сервис `backend` в Compose. `VITE_API_BASE_URL` позволяет изменить адрес API при необходимости. Для демонстрационного контента после старта выполните `docker compose run --rm backend python -m scripts.seed_stage3`.

Для остановки используйте `docker compose down`. Команда `docker compose down -v` удаляет локальные данные базы.

## Проверки

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Проверки backend и миграции описаны в соседнем репозитории. Секрет `JWT_SECRET` в `.env.example` предназначен только для локальной разработки; измените его в `.env` перед запуском.
Токен входа хранится в `localStorage`; после перезагрузки клиент проверяет его через `/auth/me`. Направления, прогресс, профиль и рекомендации каждый раз читаются с backend, поэтому браузер не является источником результатов. При ответе 401 сессия завершается. Хаб этапа 4 показывает сценарии и статусы, но запуск и прохождение появятся вместе с Phaser на этапе 5.
