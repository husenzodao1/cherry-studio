import type { AnyRoute } from '@/lib/router'

import { adminRoutes } from './admin'
import { readerRoutes } from './reader'

export const routes: AnyRoute[] = [...readerRoutes, ...adminRoutes]
