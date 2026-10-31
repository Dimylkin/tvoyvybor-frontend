.PHONY: dev-start

dev-start:
	@test -x node_modules/.bin/vite || { echo 'Установите зависимости: npm ci' >&2; exit 1; }
	npm run dev -- --host 127.0.0.1 --strictPort
