#!/bin/bash
set -euo pipefail

# Ensure host keys exist
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
  ssh-keygen -A
fi

# Update user/pass from env (Cloud Run is stateless)
: "${SSH_USER:=n4}"
: "${SSH_PASSWORD:=N4@ssh123}"
echo "${SSH_USER}:${SSH_PASSWORD}" | chpasswd || true

# Hardened minimal sshd (listen only inside container)
SSHD_CFG="/etc/ssh/sshd_config"
cat > "$SSHD_CFG" <<EOF
Port ${SSH_PORT:-22}
ListenAddress 127.0.0.1
Protocol 2
PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin no
X11Forwarding no
ClientAliveInterval 120
ClientAliveCountMax 2
AllowUsers ${SSH_USER}
Subsystem sftp /usr/lib/openssh/sftp-server
EOF

mkdir -p /var/run/sshd
echo "[WS-SSH] Starting sshd on 127.0.0.1:${SSH_PORT:-22}"
/usr/sbin/sshd -D -e -f "$SSHD_CFG" &
SSHD_PID=$!

# Start WS bridge on $PORT with WS_PATH
: "${PORT:=8080}"
: "${WS_PATH:=/app53}"
: "${AUTH_KEY:=change-this-key}"

echo "[WS-SSH] Starting WebSocket bridge on :${PORT}${WS_PATH}"
node /opt/wsproxy/ws-bridge.js &
BRIDGE_PID=$!

# Wait forever (or until child dies)
wait $BRIDGE_PID
