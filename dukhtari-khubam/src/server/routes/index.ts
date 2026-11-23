import type { AnyRoute } from '@/lib/router'

import { adminRoutes } from './admin'
import { billingRoutes } from './billing'
import { mahliyoRoutes } from './mahliyo'
import { offlineRoutes } from './offline'
import { readerRoutes } from './reader'
import { workspaceRoutes } from './workspace'

export const routes: AnyRoute[] = [...readerRoutes, ...offlineRoutes, ...mahliyoRoutes, ...billingRoutes, ...workspaceRoutes, ...adminRoutes]
