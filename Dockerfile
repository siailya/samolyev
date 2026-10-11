FROM nginxinc/nginx-unprivileged:1.28.0-alpine-slim
ARG SITE_REVISION=unknown
LABEL org.opencontainers.image.revision="$SITE_REVISION"
LABEL org.opencontainers.image.source="https://github.com/siailya/samolyev"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY favicon.ico favicon.png index.html style.css init.js language.js THIRD_PARTY_LICENSES.txt /usr/share/nginx/html/
COPY en/index.html en/experience.html /usr/share/nginx/html/en/
COPY ru/index.html ru/experience.html /usr/share/nginx/html/ru/
USER 0
RUN printf '%s\n' "$SITE_REVISION" > /usr/share/nginx/html/revision.txt
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
