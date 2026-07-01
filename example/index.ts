import { Elysia } from 'elysia'
import { staticPlugin } from '../src/index'
import { node } from '@elysia/node'
import { isBun } from '../src/utils'
;(async () => {
    const app = new Elysia(isBun ? {} : { adapter: node() })
        .use(
            await staticPlugin({
                prefix: 'hi',
                assets: 'public',
                alwaysStatic: true,
                bunFullstack: true,
                decodeURI: false,
                etag: false
                // staticLimit: 1
            })
        )
        .listen(3005)
    await app.modules
    console.log(app.routes)
})() // no top-level awaits allowed for cjs (error triggered by `bun dev:node`) (idk how to fix this)
