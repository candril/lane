# Personal recipes, not checked in (audit-public lives here)
import? 'local.just'

# Default recipe - show available commands
default:
    @just --list

# Run the TUI application (real Jira by default; requires JIRA_API_TOKEN)
run:
    bun src/index.tsx

# Run with hot reload (real Jira)
dev:
    bun --watch src/index.tsx

# Run against the offline mock board (no Jira needed)
mock:
    bun --watch src/index.tsx --mock

# Install dependencies
install:
    bun install

# Add a new dependency
add package:
    bun add {{package}}

# Add a dev dependency
add-dev package:
    bun add -d {{package}}

# Run tests
test:
    bun test

# Type check without emitting
typecheck:
    bun run typecheck

# Run all checks: typecheck + lint + fmt
check:
    just typecheck
    just lint
    just fmt-check

# Lint source files
lint:
    bun run lint

# Lint and auto-fix
lint-fix:
    bun run lint:fix

# Format source files
fmt:
    bun run fmt

# Check formatting without writing
fmt-check:
    bun run fmt:check

# Build standalone binary for current platform
build:
    bun scripts/build.ts

# Build standalone binaries for every supported platform
build-all:
    bun scripts/build.ts --all

# Build and install the binary to ~/.local/bin
install-bin: build
    cp dist/lane ~/.local/bin/lane

# Open the demo board for screenshots: isolated state, fixed version label
shot:
    XDG_CACHE_HOME=/tmp/lane-shot/cache XDG_STATE_HOME=/tmp/lane-shot/state \
    XDG_CONFIG_HOME=/tmp/lane-shot/config \
    bun --define 'LANE_VERSION="0.1.0"' src/index.tsx --mock

# Take every docs screenshot from the demo board, unattended (tmux + python3/Pillow)
shots *names:
    bash scripts/shots.sh {{names}}

# Record the README demo gif from the demo board, unattended (tmux + python3/Pillow)
demo-gif:
    bash scripts/demo.sh

# Run the documentation site locally
site-dev:
    cd site && bun run dev

# Build the documentation site
site-build:
    cd site && bun run build
