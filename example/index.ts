import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'

import html from '../public/html/index.html'

const app = new Elysia()
    .use(
        await staticPlugin()
    )
    .listen(3000)

await app.modules
