.PHONY: help deploy delete status logs scale restart port-forward describe

NAMESPACE := dev
APP_NAME := support-rag-frontend
PORT := 8080

help: ## Показать справку
	@echo "\033[0;34mKubernetes команды для Zyfra Frontend:\033[0m"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[0;32m%-20s\033[0m %s\n", $$1, $$2}'

deploy: ## Развернуть приложение
	@echo "\033[0;34m→ Развертывание в namespace $(NAMESPACE)...\033[0m"
	kubectl apply -k .
	@echo "\033[0;32m✓ Развертывание завершено\033[0m"

delete: ## Удалить приложение
	@echo "\033[0;33m→ Удаление из namespace $(NAMESPACE)...\033[0m"
	kubectl delete -k .
	@echo "\033[0;32m✓ Удаление завершено\033[0m"

status: ## Показать статус всех ресурсов
	@echo "\033[0;34m→ Статус ресурсов в namespace $(NAMESPACE):\033[0m"
	kubectl get all -n $(NAMESPACE) -l app=$(APP_NAME)

pods: ## Показать все поды
	kubectl get pods -n $(NAMESPACE) -l app=$(APP_NAME)

logs: ## Показать логи
	kubectl logs -n $(NAMESPACE) -l app=$(APP_NAME) --tail=100 -f

logs-all: ## Показать логи всех реплик
	kubectl logs -n $(NAMESPACE) -l app=$(APP_NAME) --all-containers=true --tail=100

describe: ## Подробная информация о deployment
	kubectl describe deployment $(APP_NAME) -n $(NAMESPACE)

events: ## Показать события
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp' | tail -20

scale: ## Масштабировать (использование: make scale REPLICAS=3)
	@echo "\033[0;34m→ Масштабирование до $(REPLICAS) реплик...\033[0m"
	kubectl scale deployment $(APP_NAME) -n $(NAMESPACE) --replicas=$(REPLICAS)
	@echo "\033[0;32m✓ Масштабирование завершено\033[0m"

restart: ## Перезапустить deployment
	@echo "\033[0;34m→ Перезапуск deployment...\033[0m"
	kubectl rollout restart deployment $(APP_NAME) -n $(NAMESPACE)
	kubectl rollout status deployment $(APP_NAME) -n $(NAMESPACE)
	@echo "\033[0;32m✓ Перезапуск завершен\033[0m"

rollout-status: ## Статус rollout
	kubectl rollout status deployment $(APP_NAME) -n $(NAMESPACE)

rollout-history: ## История rollout
	kubectl rollout history deployment $(APP_NAME) -n $(NAMESPACE)

rollback: ## Откатить на предыдущую версию
	@echo "\033[0;33m→ Откат на предыдущую версию...\033[0m"
	kubectl rollout undo deployment $(APP_NAME) -n $(NAMESPACE)
	@echo "\033[0;32m✓ Откат завершен\033[0m"

port-forward: ## Port-forward на локальный порт (по умолчанию 8080)
	@echo "\033[0;32m→ Port-forward на http://localhost:$(PORT)\033[0m"
	@echo "\033[0;33m→ Нажмите Ctrl+C для остановки\033[0m"
	kubectl port-forward -n $(NAMESPACE) service/$(APP_NAME)-service $(PORT):80

shell: ## Войти в под
	@POD=$$(kubectl get pod -n $(NAMESPACE) -l app=$(APP_NAME) -o jsonpath="{.items[0].metadata.name}"); \
	echo "\033[0;34m→ Вход в под $$POD...\033[0m"; \
	kubectl exec -it -n $(NAMESPACE) $$POD -- /bin/sh

top: ## Использование ресурсов подов
	kubectl top pods -n $(NAMESPACE) -l app=$(APP_NAME)

ingress: ## Информация об ingress
	kubectl get ingress -n $(NAMESPACE)
	kubectl describe ingress $(APP_NAME)-ingress -n $(NAMESPACE)

service: ## Информация о service
	kubectl get service -n $(NAMESPACE) $(APP_NAME)-service
	kubectl describe service -n $(NAMESPACE) $(APP_NAME)-service

endpoints: ## Показать endpoints
	kubectl get endpoints -n $(NAMESPACE) $(APP_NAME)-service

config: ## Показать конфигурацию (ConfigMaps и Secrets)
	@echo "\033[0;34mConfigMaps:\033[0m"
	kubectl get configmaps -n $(NAMESPACE)
	@echo "\n\033[0;34mSecrets:\033[0m"
	kubectl get secrets -n $(NAMESPACE)

apply-hpa: ## Применить автомасштабирование (HPA)
	kubectl apply -f hpa.yaml
	@echo "\033[0;32m✓ HPA применен\033[0m"

get-hpa: ## Показать статус HPA
	kubectl get hpa -n $(NAMESPACE)

watch: ## Наблюдать за статусом подов в реальном времени
	watch kubectl get pods -n $(NAMESPACE) -l app=$(APP_NAME)

dry-run: ## Проверить манифесты без применения
	kubectl apply -k . --dry-run=client

diff: ## Показать изменения перед применением
	kubectl diff -k .

validate: ## Валидация манифестов
	@echo "\033[0;34m→ Валидация манифестов...\033[0m"
	kubectl apply -k . --dry-run=server
	@echo "\033[0;32m✓ Манифесты валидны\033[0m"

clean-failed: ## Удалить failed поды
	kubectl delete pods -n $(NAMESPACE) --field-selector status.phase=Failed

update-image: ## Обновить образ (использование: make update-image TAG=1.1)
	@echo "\033[0;34m→ Обновление образа до версии $(TAG)...\033[0m"
	kubectl set image deployment/$(APP_NAME) -n $(NAMESPACE) \
		$(APP_NAME)=zyfrabotfront:$(TAG)
	kubectl rollout status deployment $(APP_NAME) -n $(NAMESPACE)
	@echo "\033[0;32m✓ Образ обновлен\033[0m"

full-deploy: ## Полное развертывание (пересборка + deploy)
	@echo "\033[0;34m→ Полное развертывание...\033[0m"
	cd .. && docker build -f Dockerfile -t zyfrabotfront:1.0 .
	$(MAKE) deploy
	@echo "\033[0;32m✓ Полное развертывание завершено\033[0m"

