/* eslint-disable no-console -- this module is the sanctioned console sink for provider calls */

/**
 * Thin request logger for provider calls (ports presto's `logRequest`). Wraps a
 * promise so each CLI invocation is visible with its duration in the OpenTUI
 * console pane; failures are logged with their message and rethrown.
 */
export async function logRequest<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await run()
    console.log(`[jira] ${label} — ${Math.round(performance.now() - start)}ms`)
    return result
  } catch (err) {
    console.error(`[jira] ${label} failed: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}
