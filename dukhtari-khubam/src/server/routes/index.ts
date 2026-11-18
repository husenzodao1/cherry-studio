import type { AnyRoute } from '@/lib/router'

import { adminRoutes } from './admin'
import { offlineRoutes } from './offline'
import { readerRoutes } from './reader'

export const routes: AnyRoute[] = [...readerRoutes, ...offlineRoutes, ...adminRoutes]
