# ТвойВыбор.exe — frontend и локальный запуск

Этот репозиторий содержит React/TypeScript приложение и Docker Compose для этапа 0 MVP. Игровые экраны и Phaser-сцены появятся на следующих этапах roadmap.

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

Для остановки используйте `docker compose down`. Команда `docker compose down -v` удаляет локальные данные базы.

## Проверки

```sh
npm ci
npm run lint
npm run typecheck
npm run build
```

Проверки backend и миграции описаны в соседнем репозитории. Секрет `JWT_SECRET` в `.env.example` предназначен только для локальной разработки; измените его в `.env` перед запуском.
