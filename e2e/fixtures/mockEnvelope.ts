/** Shared API envelope helpers for e2e mocks, matching src/lib/apiResponse.ts. */

export function successfulJson(data: unknown, message?: string) {
  return { success: true, data, message };
}

export function failJson(message: string) {
  return { success: false, error: message };
}
