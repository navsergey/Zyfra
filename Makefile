.PHONY: help build up down restart logs clean rebuild shell

# Цвета для вывода
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Показать справку
	@echo "$(BLUE)Доступные команды:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

build: ## Собрать Docker образ
	@echo "$(BLUE)Сборка Docker образа...$(NC)"
	docker-compose build

up: ## Запустить приложение
	@echo "$(BLUE)Запуск приложения...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Приложение запущено: http://localhost:4200$(NC)"

down: ## Остановить приложение
	@echo "$(YELLOW)Остановка приложения...$(NC)"
	docker-compose down

restart: ## Перезапустить приложение
	@echo "$(YELLOW)Перезапуск приложения...$(NC)"
	docker-compose restart

logs: ## Показать логи
	docker-compose logs -f

clean: ## Удалить контейнеры, образы и volumes
	@echo "$(YELLOW)Очистка Docker ресурсов...$(NC)"
	docker-compose down -v
	docker rmi zyfra10-support-rag-frontend 2>/dev/null || true
	@echo "$(GREEN)✓ Очистка завершена$(NC)"

rebuild: ## Пересобрать без кэша и запустить
	@echo "$(BLUE)Пересборка без кэша...$(NC)"
	docker-compose build --no-cache
	docker-compose up -d
	@echo "$(GREEN)✓ Пересборка завершена: http://localhost:4200$(NC)"

shell: ## Войти в контейнер
	@echo "$(BLUE)Вход в контейнер...$(NC)"
	docker exec -it zyfra-app sh

status: ## Показать статус контейнеров
	@echo "$(BLUE)Статус контейнеров:$(NC)"
	docker-compose ps

dev: ## Запустить в режиме разработки (не в Docker)
	@echo "$(BLUE)Запуск в режиме разработки...$(NC)"
	npm start

install: ## Установить зависимости
	@echo "$(BLUE)Установка зависимостей...$(NC)"
	npm install --legacy-peer-deps

