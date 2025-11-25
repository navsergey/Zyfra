# ⚡ ConfigMap Quick Start

## Что сделано:

`baseApiUrl` в `chat-service.ts` теперь берётся из ConfigMap вместо захардкоженного значения.

---

## 🔄 Как работает:

```
ConfigMap → Deployment (env) → generate-config.sh → config.js → Angular (window.config.apiUrl)
```

---

## 🚀 Развертывание за 3 шага:

### 1️⃣ Пересобрать образ

```bash
docker build -f Dockerfile -t certificationbot.study.dp.zyfra.com/support-rag-frontend:1.0 .
docker push certificationbot.study.dp.zyfra.com/support-rag-frontend:1.0
```

### 2️⃣ Применить манифесты

```bash
kubectl apply -k k8s/
```

### 3️⃣ Перезапустить

```bash
kubectl rollout restart deployment support-rag-frontend -n dev
```

---

## ✅ Проверка:

```bash
# Проверить ConfigMap
kubectl get configmap support-rag-frontend-config -n dev

# Проверить переменную в поде
POD=$(kubectl get pod -n dev -l app=support-rag-frontend -o jsonpath="{.items[0].metadata.name}")
kubectl exec -n dev $POD -- env | grep API_URL

# Проверить config.js
kubectl exec -n dev $POD -- cat /usr/share/nginx/html/config.js
```

В браузере (DevTools Console):
```javascript
console.log(window.config.apiUrl);
```

---

## 🔧 Изменение API URL:

```bash
# Отредактировать ConfigMap
kubectl edit configmap support-rag-frontend-config -n dev

# Перезапустить поды
kubectl rollout restart deployment support-rag-frontend -n dev
```

---

## 📁 Созданные файлы:

- ✅ `k8s/configmap.yaml` - ConfigMap с API_URL
- ✅ `generate-config.sh` - скрипт генерации config.js
- 🔧 `Dockerfile` - обновлён (добавлен скрипт)
- 🔧 `src/index.html` - обновлён (подключен config.js)
- 🔧 `src/app/services/chat-service.ts` - обновлён (читает из window.config)
- 🔧 `k8s/deployment.yaml` - обновлён (env из ConfigMap)

---

**Готово!** Подробности в `k8s/CONFIGMAP_SETUP.md` 📚

