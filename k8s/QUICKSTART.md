# 🚀 Kubernetes Quick Start

## Развертывание за 3 команды

### 1. Подготовка образа

Если используете локальный Kubernetes (minikube/kind):

```bash
# Для Minikube
eval $(minikube docker-env)
docker build -f Dockerfile -t zyfrabotfront:1.0 .

# Для Kind
kind load docker-image zyfrabotfront:1.0

# Для удаленного registry (замените на ваш)
docker tag zyfrabotfront:1.0 your-registry.com/zyfrabotfront:1.0
docker push your-registry.com/zyfrabotfront:1.0
# И обновите image в k8s/deployment.yaml
```

---

### 2. Применить манифесты

```bash
kubectl apply -k k8s/
```

**Или по отдельности:**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

---

### 3. Проверить и открыть

```bash
# Проверить статус
kubectl get all -n dev

# Port-forward для тестирования
kubectl port-forward -n dev service/support-rag-frontend-service 8080:80

# Открыть в браузере
# http://localhost:8080
```

---

## 🌐 Доступ через Ingress

### Добавьте в hosts файл:

**Linux/Mac:**
```bash
echo "$(kubectl get ingress -n dev support-rag-frontend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}') zyfra.dev.local" | sudo tee -a /etc/hosts
```

**Windows (PowerShell как Администратор):**
```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "$(kubectl get ingress -n dev support-rag-frontend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}') zyfra.dev.local"
```

**Для Minikube:**
```bash
echo "$(minikube ip) zyfra.dev.local" | sudo tee -a /etc/hosts
```

Откройте: http://zyfra.dev.local

---

## ✅ Проверка

```bash
# Все ресурсы в namespace dev
kubectl get all -n dev

# Подробная информация
kubectl describe deployment support-rag-frontend -n dev

# Логи
kubectl logs -n dev -l app=support-rag-frontend --tail=50
```

---

## 🗑️ Удаление

```bash
kubectl delete -k k8s/
```

**Готово!** 🎉

