#!/usr/bin/env bash
#
# Arcanea Kura — smoke test
# Drives the local build, verifies dist/ contents, then walks you through
# the manual Chrome steps because automation cannot click "Load unpacked"
# for you. Run from the repo root.
#
# Usage:
#   bash scripts/smoke-test.sh
#

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors only if stdout is a tty
if [ -t 1 ]; then
  readonly C_OK="\033[1;32m"
  readonly C_FAIL="\033[1;31m"
  readonly C_INFO="\033[1;36m"
  readonly C_DIM="\033[2m"
  readonly C_END="\033[0m"
else
  readonly C_OK=""
  readonly C_FAIL=""
  readonly C_INFO=""
  readonly C_DIM=""
  readonly C_END=""
fi

step() { printf "${C_INFO}▸ %s${C_END}\n" "$*"; }
ok()   { printf "${C_OK}✓ %s${C_END}\n" "$*"; }
fail() { printf "${C_FAIL}✗ %s${C_END}\n" "$*"; }
dim()  { printf "${C_DIM}%s${C_END}\n" "$*"; }

printf "\n${C_INFO}Arcanea Kura smoke test — $(date -u +"%Y-%m-%dT%H:%M:%SZ")${C_END}\n"
printf "${C_DIM}repo: %s${C_END}\n\n" "$REPO_ROOT"

# ----- 1. Toolchain ---------------------------------------------------------

step "1. Toolchain check"

if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm not installed. https://pnpm.io/installation"
  exit 1
fi
ok "pnpm $(pnpm --version)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node $NODE_MAJOR < 20. See .nvmrc."
  exit 1
fi
ok "node $(node --version)"

# ----- 2. Install -----------------------------------------------------------

step "2. pnpm install"
pnpm install --frozen-lockfile || pnpm install

# ----- 3. Typecheck ---------------------------------------------------------

step "3. pnpm typecheck"
if pnpm typecheck >/tmp/kura-typecheck.log 2>&1; then
  ok "typecheck clean"
else
  fail "typecheck failed — see /tmp/kura-typecheck.log"
  tail -20 /tmp/kura-typecheck.log
  exit 1
fi

# ----- 4. Build -------------------------------------------------------------

step "4. pnpm build"
if pnpm build >/tmp/kura-build.log 2>&1; then
  ok "build green"
else
  fail "build failed — see /tmp/kura-build.log"
  tail -30 /tmp/kura-build.log
  exit 1
fi

# ----- 5. Dist sanity checks ------------------------------------------------

step "5. Dist sanity"

required=(
  "dist/manifest.json"
  "dist/popup.html"
  "dist/sidepanel.html"
  "dist/service-worker-loader.js"
  "dist/icons/icon-16.png"
  "dist/icons/icon-48.png"
  "dist/icons/icon-128.png"
)
missing=0
for f in "${required[@]}"; do
  if [ -f "$f" ]; then
    ok "$f ($(wc -c < "$f") bytes)"
  else
    fail "missing: $f"
    missing=$((missing + 1))
  fi
done
[ "$missing" -gt 0 ] && { fail "$missing required dist file(s) missing"; exit 1; }

# ----- 6. Manifest sanity ---------------------------------------------------

step "6. manifest.json sanity"

name="$(node -p 'JSON.parse(require("fs").readFileSync("dist/manifest.json","utf8")).name')"
ver="$(node -p 'JSON.parse(require("fs").readFileSync("dist/manifest.json","utf8")).version')"
mv="$(node -p 'JSON.parse(require("fs").readFileSync("dist/manifest.json","utf8")).manifest_version')"

if [ "$mv" -ne 3 ]; then fail "manifest_version is $mv, expected 3"; exit 1; fi
case "$name" in *"Kura"*) ok "name: $name" ;; *) fail "name doesn't contain 'Kura': $name"; exit 1 ;; esac
case "$ver" in 0.2.*) ok "version: $ver" ;; *) fail "version not 0.2.x: $ver"; exit 1 ;; esac

# ----- 7. Bridge connectivity (optional) -----------------------------------

step "7. Bridge health (optional)"
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 4 https://arcanea.ai/api/kura/health >/tmp/kura-health.json 2>/dev/null; then
    ok "arcanea.ai/api/kura/health → $(cat /tmp/kura-health.json | head -c 200)"
  else
    dim "arcanea.ai bridge unreachable (expected if not deployed yet — popup will hide the opt-in)"
  fi
else
  dim "curl not installed — skipped"
fi

# ----- 8. Next steps --------------------------------------------------------

printf "\n${C_OK}═══ Automated checks passed ═══${C_END}\n\n"
cat <<'NEXT'
Now the parts that require your hands on a real browser:

  A) Load unpacked
     1. Open chrome://extensions/
     2. Toggle Developer mode (top right)
     3. Click "Load unpacked"
     4. Select this repo's dist/ folder
     5. Pin Arcanea Kura to the toolbar

  B) Capture a real conversation
     1. Open any of: chatgpt.com / claude.ai / gemini.google.com /
        grok.com / chat.deepseek.com / www.perplexity.ai
     2. Open or start a conversation worth keeping
     3. Click the Kura icon → "Export to Kura"
     4. Verify files at: ~/Downloads/ArcaneaKura/<platform>/<date>_<slug>/
                          ├── conversation.md  (YAML frontmatter + body)
                          ├── prompts.md       (user prompts only)
                          └── assets/          (if media present)

  C) Open the vault in Obsidian
     File → Open vault → ~/Downloads/ArcaneaKura/ → graph view should render

  D) Run the processing skill
     Open Claude Code in any directory, then:
       /kura-process ~/Downloads/ArcaneaKura
     Verify _entities/{characters,locations,artifacts,lore}/*.md notes appear

If any of A–D fail, the failure point tells you exactly what's broken:
  - Loaded but no popup → service worker bug (check chrome://extensions
    inspect "service worker")
  - Popup but "Not on a supported AI platform" → manifest host_permissions
  - Capture clicked but no files → scraper drift on src/content/<platform>.ts
  - Files exist but Obsidian graph is empty → frontmatter rendering issue
  - /kura-process runs but extracts nothing → tune the taxonomy rules in
    .claude/commands/kura-process.md

NEXT
NEXT
