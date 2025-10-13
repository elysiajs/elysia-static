import { Elysia } from 'elysia'

import { staticPlugin } from '../src/index'

import html from '../public/html/index.html'

const app = new Elysia()
	.get('', html)
    .use(
        staticPlugin({
            alwaysStatic: true
        })
    )
    .listen(3000)

await app.modules
