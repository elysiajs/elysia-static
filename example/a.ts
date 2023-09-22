import { Elysia } from 'elysia'
import { staticPlugin } from '../src'

const a = async () => {
    return new Elysia()
}

const app = new Elysia()
    .use(a())
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
    .listen(300)
