#!/bin/sh

# Скрипт для генерации конфигурации из переменных окружения
# Используется в Docker контейнере для прокидывания ConfigMap значений в Angular

cat > /usr/share/nginx/html/config.js << EOF
window.config = {
  apiUrl: "${API_URL:-https://dev.study.dp.zyfra.com/}"
};
EOF

echo "Config generated:"
cat /usr/share/nginx/html/config.js

