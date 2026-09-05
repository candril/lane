import { readFileSync } from "node:fs"

/**
 * Jira Cloud REST transport. This module is the *only* place credentials are
 * handled (see specs/nfr/003): the API token is read from `JIRA_API_TOKEN`, held
 * in memory for the process lifetime, put into the Basic-auth header, and sent
 * only to the configured `server:` host. It is never logged, thrown in an error,
 * or written anywhere.
 */

/** Expand a leading `~/` to the home directory so config paths can be written tersely. */
export function expandHome(path: string): string {
  return path.startsWith("~/") ? `${process.env.HOME ?? ""}/${path.slice(2)}` : path
}

export interface JiraCredentials {
  /** Instance base URL, no trailing slash — e.g. `https://acme.atlassian.net`. */
  baseUrl: string
  /** Atlassian account email (the Basic-auth username). */
  email: string
  /** API token (the Basic-auth password). */
  token: string
}

/**
 * Raised when credentials can't be assembled. Carries a user-facing message; the
 * token itself is never referenced here.
 */
export class JiraAuthError extends Error {}

/**
 * A Jira REST error response. Surfaces status + the API's own `errorMessages` /
 * `errors` so failures are actionable — but never the request headers.
 */
export class JiraApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message)
    this.name = "JiraApiError"
  }
}

/** Path to the `jira` CLI YAML we still read `server:`/`login:` from (specs/031). */
function jiraYamlPath(configPath?: string): string {
  return (
    configPath ??
    process.env.JIRA_CONFIG_FILE ??
    `${process.env.HOME ?? ""}/.config/.jira/.config.yml`
  )
}

/**
 * Resolve `{ baseUrl, email, token }` from the environment and the jira YAML.
 * The base URL and account email live in the YAML (`server:` / `login:`) — the
 * same file jira-cli was configured with — so no new config is needed; only the
 * token comes from `JIRA_API_TOKEN`. Throws {@link JiraAuthError} if any is missing.
 */
export function resolveCredentials(configPath?: string): JiraCredentials {
  const token = process.env.JIRA_API_TOKEN?.trim()
  if (!token) {
    throw new JiraAuthError("JIRA_API_TOKEN is not set.")
  }

  const path = jiraYamlPath(configPath)
  const yaml = tryReadYaml(path)
  if (yaml === undefined) {
    throw new JiraAuthError(`can't read Jira config at ${path} (for server URL + account email).`)
  }
  const baseUrl = yaml.match(/^\s*server:\s*(\S+)/m)?.[1]?.replace(/\/+$/, "")
  const email = yaml.match(/^\s*login:\s*(\S+)/m)?.[1]
  if (!baseUrl) {
    throw new JiraAuthError(`no \`server:\` in ${path}.`)
  }
  if (!email) {
    throw new JiraAuthError(`no \`login:\` (account email) in ${path}.`)
  }
  return { baseUrl, email, token }
}

function tryReadYaml(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

export interface JiraClient {
  readonly baseUrl: string
  /**
   * Issue a REST call. `path` is relative to the instance root (e.g.
   * `/rest/api/3/myself`). Returns parsed JSON, or `undefined` for an empty
   * (204) body. Throws {@link JiraApiError} on a non-2xx response.
   */
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>
}

export function createJiraClient(creds: JiraCredentials): JiraClient {
  const auth = `Basic ${Buffer.from(`${creds.email}:${creds.token}`).toString("base64")}`

  return {
    baseUrl: creds.baseUrl,
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const res = await fetch(`${creds.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      const text = await res.text()
      if (!res.ok) {
        throw new JiraApiError(res.status, path, formatError(res.status, text))
      }
      // 204 (assign, transition) and other empty bodies have nothing to parse.
      return (text ? JSON.parse(text) : undefined) as T
    },
  }
}

/** Turn a Jira error body into a one-line message; falls back to the raw text. */
function formatError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      errorMessages?: string[]
      errors?: Record<string, string>
    }
    const parts = [
      ...(parsed.errorMessages ?? []),
      ...Object.entries(parsed.errors ?? {}).map(([field, msg]) => `${field}: ${msg}`),
    ]
    if (parts.length > 0) {
      return `HTTP ${status} — ${parts.join("; ")}`
    }
  } catch {
    // Non-JSON body (e.g. an HTML 401 page) — fall through to the raw text.
  }
  return `HTTP ${status}${text ? ` — ${text.slice(0, 200)}` : ""}`
}
