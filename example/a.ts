import { Elysia } from 'elysia'
import { staticPlugin } from '../src'
import { req } from '../test/utils'

const app = new Elysia().use(
    staticPlugin({
        alwaysStatic: true,
        extension: false
    })
)

await app.modules

const res = await app.handle(req('/public/takodachi'))

console.log(res.headers.toJSON())

// expect(res.headers.get('Etag')).toBe('ZGe9eXgawZBlMox8sZg82Q==')
// expect(res.status).toBe(200)
