.DEFAULT_GOAL := help

.PHONY: help install dev-start lint typecheck test build check

help:
	@printf '%s\n' \
		'Frontend project targets:' \
		'  install    Install locked dependencies with npm ci' \
		'  dev-start  Run the frontend on 127.0.0.1:5173' \
		'  lint       Run ESLint' \
		'  typecheck  Check TypeScript types' \
		'  test       Run unit and jsdom UI tests' \
		'  build      Create the production build' \
		'  check      Run lint, typecheck, tests, and build'

install:
	npm ci

dev-start:
	@test -x node_modules/.bin/vite || { echo 'Установите зависимости: npm ci' >&2; exit 1; }
	npm run dev -- --host 127.0.0.1 --strictPort

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

build:
	npm run build

check: lint typecheck test build
