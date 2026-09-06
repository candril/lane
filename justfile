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
#
# `install` replaces the inode deliberately: copying over the existing file keeps it, and
# macOS kills a running binary whose cached code signature no longer matches — silently,
# exit 137.
install-bin: build
    mkdir -p ~/.local/bin
    install -m 755 dist/lane ~/.local/bin/lane
    @~/.local/bin/lane --version >/dev/null || (echo "installed binary does not run" && exit 1)
    @echo "installed: ~/.local/bin/lane $(~/.local/bin/lane --version)"

# Tag a release: just release 0.2.0 (pushing the tag is what builds and publishes it)
#
# The tag is the version a released binary reports, so package.json and CHANGELOG.md are
# checked against it here rather than after four runners have built the wrong number.
# jj cannot create git tags, hence plain `git tag` against the colocated repo.
release version:
    @grep -q '"version": "{{version}}"' package.json || (echo "package.json is not {{version}}" && exit 1)
    @grep -q '^## \[{{version}}\]' CHANGELOG.md || (echo "CHANGELOG.md has no [{{version}}] section" && exit 1)
    @test -z "$(jj diff --name-only)" || (echo "working copy has uncommitted changes" && exit 1)
    just check
    just test
    git tag v{{version}}
    @echo "tagged v{{version}} at $(git rev-parse --short HEAD)"
    @echo "publish it with: git push origin v{{version}}"

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
