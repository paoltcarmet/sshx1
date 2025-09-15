FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=8080 \
    WS_PATH=/app53 \
    SSH_USER=n4 \
    SSH_PASSWORD=N4@ssh123 \
    SSH_PORT=22 \
    AUTH_KEY=change-this-key

# Base packages + dos2unix for CRLF fix
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server nodejs npm curl ca-certificates tini dos2unix \
 && rm -rf /var/lib/apt/lists/*

# SSHD prep
RUN mkdir -p /var/run/sshd /var/log/ssh
RUN useradd -m -s /bin/bash ${SSH_USER} \
 && echo "${SSH_USER}:${SSH_PASSWORD}" | chpasswd

# Node WS bridge
WORKDIR /opt/wsproxy
COPY ws-bridge.js /opt/wsproxy/ws-bridge.js
RUN dos2unix /opt/wsproxy/ws-bridge.js || true
RUN npm init -y >/dev/null 2>&1 && npm install ws --silent

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh || true && chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["/entrypoint.sh"]
