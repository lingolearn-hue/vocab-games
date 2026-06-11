#!/bin/sh
# Run once after cloning to install push guard hooks

ROOT=$(git rev-parse --show-toplevel)

cat > "$ROOT/.git/hooks/pre-push" << 'HOOK'
#!/bin/sh
if [ -f "$(git rev-parse --show-toplevel)/.nopush" ]; then
  echo "🚫 Push blocked: .nopush file exists."
  echo "   Delete .nopush to enable pushing."
  exit 1
fi
exit 0
HOOK

cat > "$ROOT/.git/hooks/post-push" << 'HOOK'
#!/bin/sh
touch "$(git rev-parse --show-toplevel)/.nopush"
echo "🔒 Push guard re-enabled."
HOOK

chmod +x "$ROOT/.git/hooks/pre-push" "$ROOT/.git/hooks/post-push"
touch "$ROOT/.nopush"
echo "✓ Push guard installed. Delete .nopush to enable pushing."
