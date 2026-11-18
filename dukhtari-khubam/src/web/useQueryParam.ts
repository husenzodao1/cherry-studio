'use client'

import { useSearchParams } from 'next/navigation'

/**
 * Detail pages take their id from the query string (/lesson?id=…), so the app can be exported as
 * static files for the Android build and still open any lesson that arrives in a later content update.
 */
export const useQueryParam = (name: string): string => useSearchParams()?.get(name) ?? ''
