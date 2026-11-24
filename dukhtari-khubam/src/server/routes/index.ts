import type { AnyRoute } from '@/lib/router'

import { adminRoutes } from './admin'
import { billingRoutes } from './billing'
import { mahliyoRoutes } from './mahliyo'
import { mmtRoutes } from './mmt'
import { navigateRoutes } from './navigate'
import { musicFindRoutes } from './music'
import { newsRoutes } from './news'
import { offlineRoutes } from './offline'
import { readerRoutes } from './reader'
import { sosRoutes } from './sos'
import { voiceRoutes } from './voice'
import { telegramRoutes } from './telegram'
import { workspaceRoutes } from './workspace'

export const routes: AnyRoute[] = [...readerRoutes, ...offlineRoutes, ...mahliyoRoutes, ...billingRoutes, ...workspaceRoutes, ...navigateRoutes, ...voiceRoutes, ...newsRoutes, ...musicFindRoutes, ...telegramRoutes, ...sosRoutes, ...mmtRoutes, ...adminRoutes]
