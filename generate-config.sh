#!/bin/sh

# Скрипт для генерации конфигурации из переменных окружения
# Используется в Docker контейнере для прокидывания ConfigMap значений в Angular

BASE_HREF_VALUE="${BASE_HREF:-/ui}"
# Убеждаемся, что base href заканчивается на / (Angular требует это)
case "${BASE_HREF_VALUE}" in
  */) ;;
  *) BASE_HREF_VALUE="${BASE_HREF_VALUE}/" ;;
esac

# Генерация config.js
cat > /usr/share/nginx/html/config.js << EOF
window.config = {
  apiUrl: "${API_URL:-https://dev.study.dp.zyfra.com/}",
  baseHref: "${BASE_HREF_VALUE}"
};
EOF

# Обновление base href в index.html
if [ -f /usr/share/nginx/html/index.html ]; then
  # Заменяем значение href в теге <base>
  sed -i "s|<base id=\"base-href\" href=\"[^\"]*\"|<base id=\"base-href\" href=\"${BASE_HREF_VALUE}\"|g" /usr/share/nginx/html/index.html
  echo "Updated base href in index.html to: ${BASE_HREF_VALUE}"
fi

echo "Config generated:"
cat /usr/share/nginx/html/config.js

