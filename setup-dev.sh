#!/bin/sh
# Run once after cloning to install push guard hooks.
ROOT=$(git rev-parse --show-toplevel)

cat > "$ROOT/.git/hooks/pre-push" << 'HOOK'
#!/bin/sh
ROOT=$(git rev-parse --show-toplevel)

# 1. Lockfile check
if [ -f "$ROOT/.nopush" ]; then
  echo "🚫 Push blocked: .nopush file exists."
  echo "   Delete .nopush to enable pushing."
  exit 1
fi

# 2. Beijing time window check (Mon–Fri 07:30–12:00 / 13:00–18:30)
BEIJING_HOUR=$(TZ='Asia/Shanghai' date +%H)
BEIJING_MIN=$(TZ='Asia/Shanghai' date +%M)
BEIJING_DOW=$(TZ='Asia/Shanghai' date +%u)
BEIJING_TIME=$((BEIJING_HOUR * 60 + BEIJING_MIN))
MORNING_START=$((7 * 60 + 30))
MORNING_END=$((12 * 60 + 0))
AFTERNOON_START=$((13 * 60 + 0))
AFTERNOON_END=$((18 * 60 + 30))
if [ "$BEIJING_DOW" -le 5 ]; then
  if { [ "$BEIJING_TIME" -ge "$MORNING_START" ] && [ "$BEIJING_TIME" -lt "$MORNING_END" ]; } || \
     { [ "$BEIJING_TIME" -ge "$AFTERNOON_START" ] && [ "$BEIJING_TIME" -lt "$AFTERNOON_END" ]; }; then
    echo "🚫 Push blocked: Beijing working hours (Mon–Fri 07:30–12:00 / 13:00–18:30)."
    echo "   Current Beijing time: $(TZ='Asia/Shanghai' date '+%H:%M %Z')"
    exit 1
  fi
fi

# 3. Passphrase check
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if echo "$REMOTE_URL" | grep -q "vocab-games-dev"; then
  REPO_NAME="DEV"
  EXPECTED_HASH="b804e08711d730bafe644dd127af76ff1aad7555d62758f2f7672222d40351e0"
else
  REPO_NAME="MAIN"
  EXPECTED_HASH="14dd9dbc39bd8b3eb5bcb656cd8633f71525f336f875a33cec8992f081200d32"
fi
echo "🔑 Passphrase required for $REPO_NAME repo push."
echo "   Current Beijing time: $(TZ='Asia/Shanghai' date '+%A %H:%M %Z')"
printf "   Enter passphrase: "
read -r PASSPHRASE < /dev/tty
ENTERED_HASH=$(printf "%s\n" "$PASSPHRASE" | sha256sum | cut -d' ' -f1)
if [ "$ENTERED_HASH" != "$EXPECTED_HASH" ]; then
  echo ""
  echo "🚫 Wrong passphrase. Push blocked."
  exit 1
fi
echo ""
echo "✓ Passphrase accepted."
exit 0
HOOK

cat > "$ROOT/.git/hooks/post-push" << 'HOOK'
#!/bin/sh
touch "$(git rev-parse --show-toplevel)/.nopush"
echo "🔒 Push guard re-enabled."
HOOK

chmod +x "$ROOT/.git/hooks/pre-push" "$ROOT/.git/hooks/post-push"
touch "$ROOT/.nopush"
echo "✓ Push guard installed."
echo "  - Lockfile: .nopush"
echo "  - Time block: Mon–Fri 07:30–12:00 / 13:00–18:30 Beijing"
echo "  - Passphrase: required and verified via SHA256 hash"
