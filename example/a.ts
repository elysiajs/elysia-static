import { Elysia } from 'elysia'
import { staticPlugin } from '../src'

const app = new Elysia()
    .use(
        staticPlugin({
            ignorePatterns: [/takodachi.png$/]
        })
    )
    .use(
        staticPlugin({
            assets: 'public-aliased',
            ignorePatterns: [/takodachi.png$/]
        })
    )
    .listen(8080)

// const file1 = await app.handle(req('/public/takodachi.png'))
// const file2 = await app.handle(req('/public/tako.png'))
// const blob1 = await file1.blob()
// const blob2 = await file2.blob()

// expect(await blob1.text()).toBe('NOT_FOUND')
// expect(await blob2.text()).toEqual(takodachi)
