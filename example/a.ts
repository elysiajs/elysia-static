import { Elysia } from 'elysia'
import { staticPlugin } from '../src'
import { req } from '../test/utils'

const app = new Elysia().use(
    staticPlugin({
        alwaysStatic: true,
        extension: false,
        headers: {
            ['x-powered-by']: 'Takodachi'
        }
    })
)

await app.modules

const res = await app.handle(req('/public/takodachi'))
console.log(res.headers.get('x-powered-by'))
