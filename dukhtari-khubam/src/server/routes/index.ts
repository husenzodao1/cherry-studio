import type { AnyRoute } from '@/lib/router'

import { adminRoutes } from './admin'
import { billingRoutes } from './billing'
import { mahliyoRoutes } from './mahliyo'
import { navigateRoutes } from './navigate'
import { offlineRoutes } from './offline'
import { readerRoutes } from './reader'
import { voiceRoutes } from './voice'
import { telegramRoutes } from './telegram'
import { workspaceRoutes } from './workspace'

export const routes: AnyRoute[] = [...readerRoutes, ...offlineRoutes, ...mahliyoRoutes, ...billingRoutes, ...workspaceRoutes, ...navigateRoutes, ...voiceRoutes, ...telegramRoutes, ...adminRoutes]
