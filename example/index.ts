import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'

const app = new Elysia()
    .use(
        staticPlugin({
            prefix: '/public-aliased',
            assets: 'public-aliased'
        })
    )
    .use(
        staticPlugin({
            prefix: '/public'
        })
    )
    .listen(8080)

await app.modules

// @ts-ignore
console.log(app.router.history)
