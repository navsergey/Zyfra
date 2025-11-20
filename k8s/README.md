# Kubernetes Deployment - Zyfra Frontend

## 📦 Структура манифестов

```
k8s/
├── namespace.yaml       # Namespace для изоляции ресурсов
├── deployment.yaml      # Развертывание приложения (2 реплики)
├── service.yaml         # Service для доступа к подам
├── ingress.yaml         # Ingress для внешнего доступа
├── kustomization.yaml   # Kustomize для управления конфигурацией
└── README.md           # Эта инструкция
```

---

## 🚀 Быстрый старт

### Вариант 1: Kubectl (напрямую)

```bash
# Применить все манифесты
kubectl apply -f k8s/

# Или по отдельности
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Вариант 2: Kustomize (рекомендуется)

```bash
# Применить через Kustomize
kubectl apply -k k8s/

# Предварительный просмотр
kubectl kustomize k8s/
```

---

## 🔍 Проверка развертывания

```bash
# Проверить namespace
kubectl get namespace dev

# Проверить deployment
kubectl get deployment -n dev
kubectl describe deployment support-rag-frontend -n dev

# Проверить pods
kubectl get pods -n dev
kubectl get pods -n dev -l app=support-rag-frontend

# Проверить service
kubectl get service -n dev
kubectl describe service support-rag-frontend-service -n dev

# Проверить ingress
kubectl get ingress -n dev
kubectl describe ingress support-rag-frontend-ingress -n dev

# Логи приложения
kubectl logs -n dev -l app=support-rag-frontend --tail=100 -f
```

---

## 🌐 Доступ к приложению

### Через Ingress (production)

Если Ingress Controller настроен:

```bash
# Добавьте в /etc/hosts (Linux/Mac) или C:\Windows\System32\drivers\etc\hosts (Windows)
<INGRESS_IP> zyfra.dev.local

# Откройте в браузере
http://zyfra.dev.local
```

### Через Port-Forward (для тестирования)

```bash
# Port-forward на service
kubectl port-forward -n dev service/support-rag-frontend-service 8080:80

# Откройте в браузере
http://localhost:8080
```

### Через Port-Forward на Pod

```bash
# Получить имя пода
kubectl get pods -n dev -l app=support-rag-frontend

# Port-forward на конкретный под
kubectl port-forward -n dev <POD_NAME> 8080:80
```

---

## ⚙️ Конфигурация

### Deployment

- **Replicas**: 2 (высокая доступность)
- **Strategy**: RollingUpdate (обновление без downtime)
- **Image**: zyfrabotfront:1.0
- **Resources**:
  - Requests: 128Mi RAM, 100m CPU
  - Limits: 256Mi RAM, 200m CPU
- **Probes**: Liveness и Readiness для автоматического восстановления

### Service

- **Type**: ClusterIP (внутренний доступ)
- **Port**: 80
- **Selector**: app=support-rag-frontend

### Ingress

- **Host**: zyfra.dev.local
- **Path**: / (все маршруты)
- **IngressClass**: nginx
- **TLS**: опционально (закомментировано)

---

## 🔧 Масштабирование

### Ручное масштабирование

```bash
# Увеличить до 5 реплик
kubectl scale deployment support-rag-frontend -n dev --replicas=5

# Уменьшить до 1 реплики
kubectl scale deployment support-rag-frontend -n dev --replicas=1
```

### Автомасштабирование (HPA)

Создайте файл `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: support-rag-frontend-hpa
  namespace: dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: support-rag-frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Применить:
```bash
kubectl apply -f k8s/hpa.yaml
```

---

## 🔄 Обновление приложения

### Rolling Update

```bash
# Обновить образ
kubectl set image deployment/support-rag-frontend -n dev \
  support-rag-frontend=zyfrabotfront:1.1

# Проверить статус обновления
kubectl rollout status deployment/support-rag-frontend -n dev

# Просмотреть историю
kubectl rollout history deployment/support-rag-frontend -n dev
```

### Откат (Rollback)

```bash
# Откатить на предыдущую версию
kubectl rollout undo deployment/support-rag-frontend -n dev

# Откатить на конкретную ревизию
kubectl rollout undo deployment/support-rag-frontend -n dev --to-revision=2
```

---

## 🔒 HTTPS / TLS

### Создание TLS сертификата (self-signed для разработки)

```bash
# Создать self-signed сертификат
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=zyfra.dev.local/O=zyfra"

# Создать Secret
kubectl create secret tls zyfra-tls-secret \
  --cert=tls.crt --key=tls.key -n dev

# Раскомментировать секцию tls в ingress.yaml и применить
kubectl apply -f k8s/ingress.yaml
```

### С Let's Encrypt (cert-manager)

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: zyfra-cert
  namespace: dev
spec:
  secretName: zyfra-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - zyfra.dev.local
```

---

## 🐛 Troubleshooting

### Pods не запускаются

```bash
# Проверить статус подов
kubectl get pods -n dev

# Посмотреть события
kubectl get events -n dev --sort-by='.lastTimestamp'

# Описание пода
kubectl describe pod <POD_NAME> -n dev

# Логи
kubectl logs -n dev <POD_NAME>
```

### ImagePullBackOff

```bash
# Проблема: образ не найден
# Решение 1: Загрузить образ в registry
docker tag zyfrabotfront:1.0 your-registry.com/zyfrabotfront:1.0
docker push your-registry.com/zyfrabotfront:1.0

# Решение 2: Для локального кластера (minikube/kind)
# Minikube:
eval $(minikube docker-env)
docker build -f Dockerfile -t zyfrabotfront:1.0 .

# Kind:
kind load docker-image zyfrabotfront:1.0
```

### Ingress не работает

```bash
# Проверить Ingress Controller
kubectl get pods -n ingress-nginx

# Проверить ingress
kubectl describe ingress support-rag-frontend-ingress -n dev

# Проверить, что host резолвится
ping zyfra.dev.local
```

### CrashLoopBackOff

```bash
# Посмотреть логи
kubectl logs -n dev <POD_NAME> --previous

# Проверить liveness/readiness probes
kubectl describe pod <POD_NAME> -n dev
```

---

## 🗑️ Удаление

### Удалить все ресурсы

```bash
# Удалить через kubectl
kubectl delete -f k8s/

# Или через kustomize
kubectl delete -k k8s/

# Удалить только namespace (удалит всё внутри)
kubectl delete namespace dev
```

### Удалить отдельные ресурсы

```bash
kubectl delete deployment support-rag-frontend -n dev
kubectl delete service support-rag-frontend-service -n dev
kubectl delete ingress support-rag-frontend-ingress -n dev
```

---

## 📊 Мониторинг

### Ресурсы

```bash
# Использование ресурсов
kubectl top pods -n dev
kubectl top nodes

# Подробная информация
kubectl describe pod <POD_NAME> -n dev | grep -A 5 "Limits:"
```

### Метрики

```bash
# Живые логи
kubectl logs -n dev -l app=support-rag-frontend --tail=100 -f

# Логи всех реплик
kubectl logs -n dev -l app=support-rag-frontend --all-containers=true

# События
kubectl get events -n dev --watch
```

---

## 🔐 Secrets и ConfigMaps

### Создание ConfigMap

```bash
# Создать ConfigMap с переменными окружения
kubectl create configmap zyfra-config -n dev \
  --from-literal=API_URL=https://api.example.com \
  --from-literal=NODE_ENV=production

# Использовать в deployment.yaml:
# envFrom:
# - configMapRef:
#     name: zyfra-config
```

### Создание Secret

```bash
# Создать Secret
kubectl create secret generic zyfra-secrets -n dev \
  --from-literal=API_KEY=your-secret-key

# Использовать в deployment.yaml:
# env:
# - name: API_KEY
#   valueFrom:
#     secretKeyRef:
#       name: zyfra-secrets
#       key: API_KEY
```

---

## 🌍 Окружения (Environments)

Для разных окружений используйте Kustomize overlays:

```
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

Применить:
```bash
kubectl apply -k k8s/overlays/dev/
kubectl apply -k k8s/overlays/production/
```

---

## 📝 Требования

- **Kubernetes**: версия 1.20+
- **kubectl**: установлен и настроен
- **Ingress Controller**: nginx-ingress (опционально)
- **Docker Image**: zyfrabotfront:1.0 в registry или локально

---

## 🎯 Checklist развертывания

- [ ] Namespace создан
- [ ] Образ доступен (в registry или локально)
- [ ] Deployment применен и pods в статусе Running
- [ ] Service создан и endpoints доступны
- [ ] Ingress настроен (если требуется внешний доступ)
- [ ] Host добавлен в /etc/hosts
- [ ] Приложение доступно через браузер
- [ ] Логи проверены на наличие ошибок

---

**Готово к развертыванию!** 🚀

Для быстрого старта: `kubectl apply -k k8s/`

