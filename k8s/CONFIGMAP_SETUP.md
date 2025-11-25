# 📝 ConfigMap для динамической конфигурации

## Как это работает

API URL теперь настраивается через ConfigMap и прокидывается в Angular приложение.

---

## 🔄 Схема работы:

```
1. ConfigMap          2. Deployment        3. Generate Script    4. Angular App
   (configmap.yaml)      (env переменная)     (config.js)          (window.config)

┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ API_URL:     │      │ env:         │      │ cat >        │      │ baseApiUrl = │
│ "https://... │ ───> │ - name:      │ ───> │ config.js    │ ───> │ window.config│
│              │      │   API_URL    │      │ << EOF       │      │ .apiUrl      │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

---

## 📦 Созданные/Изменённые файлы:

### 1. `k8s/configmap.yaml` (НОВЫЙ)
ConfigMap с API URL:
```yaml
data:
  API_URL: "https://dev.study.dp.zyfra.com/"
```

### 2. `generate-config.sh` (НОВЫЙ)
Скрипт генерации `config.js` из переменных окружения

### 3. `Dockerfile` (ИЗМЕНЁН)
Добавлен скрипт генерации:
```dockerfile
COPY generate-config.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
```

### 4. `src/index.html` (ИЗМЕНЁН)
Подключен `config.js`:
```html
<script src="config.js"></script>
```

### 5. `src/app/services/chat-service.ts` (ИЗМЕНЁН)
Чтение из `window.config`:
```typescript
baseApiUrl = (typeof window !== 'undefined' && window.config?.apiUrl) 
  || 'https://dev.study.dp.zyfra.com/';
```

### 6. `k8s/deployment.yaml` (ИЗМЕНЁН)
Прокинута переменная окружения из ConfigMap:
```yaml
env:
  - name: API_URL
    valueFrom:
      configMapKeyRef:
        name: support-rag-frontend-config
        key: API_URL
```

---

## 🚀 Применение изменений:

### Шаг 1: Пересобрать Docker образ

```bash
# Пересобрать с новым скриптом
docker build -f Dockerfile -t certificationbot.study.dp.zyfra.com/support-rag-frontend:1.0 .

# Отправить в registry
docker push certificationbot.study.dp.zyfra.com/support-rag-frontend:1.0
```

### Шаг 2: Применить ConfigMap и Deployment

```bash
# Применить через kustomize (включает configmap.yaml)
kubectl apply -k k8s/

# Или по отдельности
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
```

### Шаг 3: Перезапустить поды

```bash
# Перезапустить для применения новой конфигурации
kubectl rollout restart deployment support-rag-frontend -n dev

# Дождаться завершения
kubectl rollout status deployment support-rag-frontend -n dev
```

---

## ✅ Проверка:

### 1. Проверить ConfigMap

```bash
kubectl get configmap support-rag-frontend-config -n dev -o yaml
```

Должны увидеть:
```yaml
data:
  API_URL: https://dev.study.dp.zyfra.com/
```

### 2. Проверить переменную окружения в поде

```bash
# Получить имя пода
POD=$(kubectl get pod -n dev -l app=support-rag-frontend -o jsonpath="{.items[0].metadata.name}")

# Проверить переменную окружения
kubectl exec -n dev $POD -- env | grep API_URL
```

Должно вывести:
```
API_URL=https://dev.study.dp.zyfra.com/
```

### 3. Проверить сгенерированный config.js

```bash
# Проверить содержимое config.js
kubectl exec -n dev $POD -- cat /usr/share/nginx/html/config.js
```

Должно вывести:
```javascript
window.config = {
  apiUrl: "https://dev.study.dp.zyfra.com/"
};
```

### 4. Проверить в браузере

Откройте DevTools Console:
```javascript
console.log(window.config);
// Должно вывести: {apiUrl: "https://dev.study.dp.zyfra.com/"}
```

---

## 🔧 Изменение API URL:

### Для dev окружения:

```bash
# Отредактировать ConfigMap
kubectl edit configmap support-rag-frontend-config -n dev

# Изменить API_URL на нужный
# Сохранить и выйти

# Перезапустить поды для применения изменений
kubectl rollout restart deployment support-rag-frontend -n dev
```

### Для других окружений:

Создайте отдельные ConfigMap для каждого окружения:

**dev:**
```yaml
data:
  API_URL: "https://dev.study.dp.zyfra.com/"
```

**staging:**
```yaml
data:
  API_URL: "https://staging.study.dp.zyfra.com/"
```

**production:**
```yaml
data:
  API_URL: "https://study.dp.zyfra.com/"
```

---

## 🎯 Преимущества этого подхода:

✅ **Нет пересборки образа** - меняем только ConfigMap  
✅ **Работает в runtime** - конфигурация загружается при старте контейнера  
✅ **Разные окружения** - легко настроить разные URL для dev/staging/prod  
✅ **Безопасность** - API URL не захардкожен в коде  
✅ **Kubernetes native** - использует стандартные механизмы K8s  

---

## 🐛 Troubleshooting:

### config.js не загружается (404)

**Причина:** Скрипт не выполнился при старте контейнера

**Решение:**
```bash
# Проверить логи пода
kubectl logs -n dev $POD

# Должны увидеть:
# Config generated:
# window.config = {...}

# Проверить файл существует
kubectl exec -n dev $POD -- ls -la /usr/share/nginx/html/config.js
```

### window.config undefined

**Причина:** `config.js` загружается после Angular bootstrap

**Решение:** Убедитесь что `<script src="config.js"></script>` в `<head>` ПЕРЕД `</head>`

### API_URL не применяется

**Причина:** Переменная окружения не прокинута в под

**Решение:**
```bash
# Проверить переменную окружения
kubectl exec -n dev $POD -- env | grep API_URL

# Если пусто - проверить deployment.yaml
kubectl describe deployment support-rag-frontend -n dev | grep -A 5 Environment
```

---

## 📋 Checklist развертывания:

- [ ] `configmap.yaml` создан
- [ ] `generate-config.sh` создан
- [ ] `Dockerfile` обновлён (скрипт скопирован)
- [ ] `index.html` обновлён (`<script src="config.js"></script>`)
- [ ] `chat-service.ts` обновлён (читает из `window.config`)
- [ ] `deployment.yaml` обновлён (env из ConfigMap)
- [ ] `kustomization.yaml` обновлён (включает configmap.yaml)
- [ ] Docker образ пересобран
- [ ] ConfigMap применён (`kubectl apply -f k8s/configmap.yaml`)
- [ ] Deployment обновлён (`kubectl apply -f k8s/deployment.yaml`)
- [ ] Поды перезапущены (`kubectl rollout restart`)
- [ ] Проверка: `window.config` доступен в браузере
- [ ] Проверка: API запросы работают

---

**Готово!** 🎉 Теперь API URL настраивается через ConfigMap!

