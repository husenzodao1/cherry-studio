import { buildOpenApi } from '@/lib/openapi'
import { dispatch } from '@/lib/router'
import { routes } from '@/server/routes'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ path?: string[] }> }

async function handler(req: Request, { params }: Params): Promise<Response> {
  const { path = [] } = await params
  const joined = `/${path.join('/')}`
  if (req.method === 'GET' && joined === '/openapi.json') {
    return Response.json(buildOpenApi(routes), { headers: { 'cache-control': 'public, s-maxage=300' } })
  }
  return dispatch(routes, req, joined)
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS }
