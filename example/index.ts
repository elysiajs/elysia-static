import { Elysia } from 'elysia'
import { staticPlugin } from '../src/index'

const app = new Elysia()
    .use(
        await staticPlugin({
			prefix: '/',
			bundleHTML: false
        })
    )
    .listen(3000)

console.log(app.routes)

await app.modules
