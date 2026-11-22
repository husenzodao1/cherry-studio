/** API error model: { error: { code, message, details? } } with a matching HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown
  ) {
    super(message ?? code)
  }
}

/** Domain error codes raised by the database (private.fail) → HTTP status. */
const DOMAIN_STATUS: Record<string, number> = {
  auth_required: 401,
  forbidden: 403,
  premium_required: 403,
  not_found: 404,
  validation_failed: 422,
  protected_field: 400,
  unknown_entity: 400,
  version_conflict: 409,
  asset_in_use: 409,
  attempt_limit_reached: 409,
  retry_not_allowed: 409,
  already_checked: 409,
  attempt_closed: 409,
  attempt_not_submitted: 409,
  invalid_transition: 409,
  review_required: 409,
  last_super_admin: 409,
  not_allowed: 409,
  rate_limited: 429,
  username_taken: 409,
  taken: 409
}

const MESSAGES: Record<string, string> = {
  auth_required: 'Ворид шавед.',
  forbidden: 'Иҷозат нест.',
  premium_required: 'Барои Premium.',
  not_found: 'Ёфт нашуд.',
  validation_failed: 'Маълумот нодуруст аст.',
  version_conflict: 'Версияи навтар ҳаст. Саҳифаро нав кунед.',
  asset_in_use: 'Файл истифода мешавад.',
  rate_limited: 'Каме дертар такрор кунед.',
  username_taken: 'Ин логин банд аст.',
  taken: 'Ин почта аллакай ба ҳисоби дигар тааллуқ дорад.'
}

interface PgError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function parseDetails(details: string | null | undefined): unknown {
  if (!details) return undefined
  try {
    return JSON.parse(details)
  } catch {
    return details
  }
}

/** Map a Supabase/PostgREST/Postgres error onto the API error model. Never leaks SQL text. */
export function fromDatabase(error: PgError, status?: number): ApiError {
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === 'P0001' && message in DOMAIN_STATUS) {
    return new ApiError(DOMAIN_STATUS[message], message, MESSAGES[message], parseDetails(error.details))
  }
  if (code === 'P0001') return new ApiError(400, 'bad_request', 'Дархост нодуруст аст.')
  if (code === '42501' || /permission denied/i.test(message)) return new ApiError(403, 'forbidden', MESSAGES.forbidden)
  if (code === 'PGRST116') return new ApiError(404, 'not_found', MESSAGES.not_found)
  if (code === 'PGRST301' || code === 'PGRST302' || status === 401) return new ApiError(401, 'auth_required', MESSAGES.auth_required)
  if (code === '23505') return new ApiError(409, 'conflict', 'Чунин сабт аллакай ҳаст.')
  if (code === '23503') return new ApiError(409, 'reference_conflict', 'Сабт бо маълумоти дигар пайваст аст.')
  if (code === '23514' || code === '23502') return new ApiError(422, 'validation_failed', MESSAGES.validation_failed, { constraint: message })
  if (code === '22P02' || code === '22023' || code === '22007') return new ApiError(400, 'bad_request', 'Дархост нодуруст аст.')
  return new ApiError(500, 'internal_error', 'Хатои сервер.')
}

export function json(data: unknown, init: ResponseInit & { cache?: string } = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  if (init.cache) headers.set('cache-control', init.cache)
  return new Response(JSON.stringify(data ?? null), { status: init.status ?? 200, headers })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message, details: error.details } }, {
      status: error.status,
      cache: 'no-store'
    })
  }
  console.error('[api] unhandled error', error)
  return json({ error: { code: 'internal_error', message: 'Хатои сервер.' } }, { status: 500, cache: 'no-store' })
}
