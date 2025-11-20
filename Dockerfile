# Stage 1: Build Angular application
FROM node:20-alpine AS build

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --legacy-peer-deps

# Копирование всех файлов проекта
COPY . .

# Сборка приложения для production с base-href /ui/
RUN npm run build -- --configuration production --base-href /ui/

# Stage 2: Serve app with Nginx
FROM nginx:alpine

# Копирование собранного приложения из stage 1
COPY --from=build /app/dist/zyfra1.0/browser /usr/share/nginx/html

# Копирование кастомной конфигурации nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открытие порта 80
EXPOSE 80

# Запуск nginx
CMD ["nginx", "-g", "daemon off;"]

