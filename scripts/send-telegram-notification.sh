#!/bin/bash
# Send Telegram notifications for CI/CD events.
# Adapted from guidr's version — trimmed to the event types doen actually fires.
#
# Usage:
#   send-telegram-notification.sh --type <type> --branch <br> --run-url <url> --commit <sha> [--version <v>] [--step <s>] [--error <msg>]
#
# Types: release_success | release_skip | docker_success | docker_failure | ci_failure
#
# Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (if unset, exits 0 silently)

set -e

TELEGRAM_API="https://api.telegram.org/bot"

parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --type)    NOTIFICATION_TYPE="$2"; shift 2 ;;
      --version) VERSION="$2"; shift 2 ;;
      --branch)  BRANCH="$2"; shift 2 ;;
      --run-url) RUN_URL="$2"; shift 2 ;;
      --commit)  COMMIT="$2"; shift 2 ;;
      --error)   ERROR_MSG="$2"; shift 2 ;;
      --step)    FAILED_STEP="$2"; shift 2 ;;
      --repo)    REPO="$2"; shift 2 ;;
      --dry-run) DRY_RUN=true; shift ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done
}

escape_html() {
  local t="$1"
  t="${t//&/&amp;}"
  t="${t//</&lt;}"
  t="${t//>/&gt;}"
  echo "$t"
}

truncate_string() {
  local t="$1" max="${2:-500}"
  if [ ${#t} -gt $max ]; then echo "${t:0:$max}..."; else echo "$t"; fi
}

format_message() {
  local type="$1"
  local short="${COMMIT:0:7}"
  local br; br=$(escape_html "$BRANCH")
  local repo="${REPO:-stevendejongnl/doen}"

  case "$type" in
    release_success)
      cat <<EOF
<b>🚀 Doen v${VERSION} released</b>

<b>Branch:</b> ${br}
<b>Commit:</b> <code>${short}</code>

<a href="https://github.com/${repo}/releases/tag/v${VERSION}">Release notes</a> · <a href="${RUN_URL}">CI run</a>
EOF
      ;;
    release_skip)
      cat <<EOF
<b>ℹ️ Doen — no release needed</b>

<b>Branch:</b> ${br}
<b>Commit:</b> <code>${short}</code>
<b>Reason:</b> No relevant commits since last release

<a href="${RUN_URL}">CI run</a>
EOF
      ;;
    docker_success)
      cat <<EOF
<b>🐳 Doen ${VERSION} image pushed</b>

<b>Branch:</b> ${br}
<b>Commit:</b> <code>${short}</code>
<b>Image:</b> <code>ghcr.io/${repo}:${VERSION}</code>

Keel will roll the cluster within ~5 min. <a href="${RUN_URL}">CI run</a>
EOF
      ;;
    docker_failure|ci_failure)
      local title
      if [ "$type" = "docker_failure" ]; then title="🐳 Doen image build failed"; else title="⚠️ Doen CI failed"; fi
      {
        echo "<b>${title}</b>"
        echo ""
        echo "<b>Branch:</b> ${br}"
        echo "<b>Commit:</b> <code>${short}</code>"
        if [ -n "${FAILED_STEP}" ]; then echo "<b>Failed step:</b> $(escape_html "$FAILED_STEP")"; fi
        if [ -n "${ERROR_MSG}" ]; then
          echo ""
          echo "<b>Error:</b>"
          echo "<pre>$(escape_html "$(truncate_string "$ERROR_MSG" 500)")</pre>"
        fi
        echo ""
        echo "<a href=\"${RUN_URL}\">View logs</a>"
      }
      ;;
    *)
      echo "Error: Unknown notification type: $type" >&2
      exit 1
      ;;
  esac
}

validate_parameters() {
  for p in NOTIFICATION_TYPE BRANCH RUN_URL COMMIT; do
    if [ -z "${!p}" ]; then
      echo "Error: --${p,,} is required" >&2
      exit 1
    fi
  done
  case "$NOTIFICATION_TYPE" in
    release_success|docker_success)
      if [ -z "$VERSION" ]; then echo "Error: --version is required for $NOTIFICATION_TYPE" >&2; exit 1; fi
      ;;
  esac
}

send_telegram() {
  local message="$1"
  if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "⚠️ Telegram secrets not configured, skipping notification"
    return 0
  fi
  if [ ${#message} -gt 4000 ]; then message="${message:0:4000}...truncated"; fi

  set +e
  local response
  response=$(curl -s -X POST \
    "${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${message}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "disable_web_page_preview=false")
  local rc=$?
  set -e

  if [ $rc -ne 0 ]; then
    echo "⚠️ curl failed (exit $rc). Response: $response"
    return 0
  fi
  if echo "$response" | grep -q '"ok":true'; then
    echo "✓ Telegram notification sent"
  else
    echo "⚠️ Telegram API error: $response"
  fi
  return 0
}

main() {
  parse_arguments "$@"
  validate_parameters
  local msg
  msg=$(format_message "$NOTIFICATION_TYPE")

  if [ "$DRY_RUN" = true ]; then
    echo "==== DRY RUN ===="
    echo "$msg"
    echo "================="
    return 0
  fi
  send_telegram "$msg"
}

main "$@"
