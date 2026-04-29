import { Elysia } from 'elysia'
import { staticPlugin } from '../src/index'
import { node } from '@elysiajs/node'
const app = new Elysia({ adapter: node() })
    .use(
        await staticPlugin({
            prefix: '/',
            assets: 'public',
            bunFullstack: false
        })
    )
    .listen(3000)

console.log(app.routes)

await app.modules
