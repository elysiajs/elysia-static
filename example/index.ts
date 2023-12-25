import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'
import { join } from 'path'

const app = new Elysia()
    .use(
        staticPlugin({
            alwaysStatic: true
        })
    )
    .listen(3000)

await app.modules
