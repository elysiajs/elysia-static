import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'

const a = async () => {
    return new Elysia()
}

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
    .listen(3000)

await app.modules

console.log(app.routes)
