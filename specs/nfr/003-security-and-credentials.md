# NFR: Security & Credential Handling

**Status**: Draft

## Requirement

Jira credentials are handled safely. The app talks to Jira Cloud over the REST API directly
([../005-jira-provider](../005-jira-provider.md)), so it **does** hold the API token — but only
transiently, in memory, and only to authenticate requests to the configured instance. This NFR
constrains that handling.

## Criteria

- The **only** secret the app reads is the API token, from the `JIRA_API_TOKEN` environment
  variable. It is never read from source, `config.toml`, or persisted state, and never written
  to any file (cache, log, state).
- The token is held only in memory for the process lifetime and used solely to build the
  `Authorization: Basic` header. The account email (`login:`) and base URL (`server:`) come
  from the `jira` YAML (`~/.config/.jira/.config.yml`) — no credential.
- The token is sent **only** to the configured `server:` host, over HTTPS.
- The token (and the `Authorization` header) is never logged, echoed, or included in an error
  message, toast, or the OpenTUI console pane. Request logging records the method + path only —
  never headers or a body that could carry a secret.
- No secret-bearing files are ever committed (`.env`, any local config).

## Notes

- Credential handling is confined to a single module (`src/providers/jira/http.ts`): it reads
  the env var, builds the header, and is the one place the token is referenced. Errors raised
  from there deliberately omit the header and token.
- History: earlier the app shelled out to the `jira` CLI and held no credentials at all, but
  that blocked capabilities the CLI can't reach (issue ranking, board-config import). Moving to
  a direct REST client reintroduced token handling under the constraints above.
