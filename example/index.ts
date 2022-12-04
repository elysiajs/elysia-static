import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'

new Elysia()
    .use(
        staticPlugin({
            ignorePatterns: ['public/takodachi.png']
        })
    )
    .listen(8080)
