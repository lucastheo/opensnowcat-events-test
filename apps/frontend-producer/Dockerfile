FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json vite.config.ts index.html ./
RUN npm ci
COPY src ./src
ARG VITE_BACKEND_URL=http://localhost:4000
ARG VITE_SIMPLE_COLLECTOR_URL=http://localhost:5000
ARG VITE_OPENSNOWCAT_URL=http://localhost:8080
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_SIMPLE_COLLECTOR_URL=$VITE_SIMPLE_COLLECTOR_URL
ENV VITE_OPENSNOWCAT_URL=$VITE_OPENSNOWCAT_URL
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
