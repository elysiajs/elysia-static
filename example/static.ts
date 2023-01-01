import { Elysia } from 'elysia'
import staticPlugin from '../src'

new Elysia()
    .use(
        staticPlugin({
            alwaysStatic: true,
            noExtension: true
        })
    )
    .listen(8080)
