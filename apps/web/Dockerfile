FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w @ithraa/web
COPY apps/web apps/web
RUN npm run build -w @ithraa/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
