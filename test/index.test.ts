import { Elysia } from 'elysia'
import { staticPlugin } from '../src'

import { describe, expect, it } from 'bun:test'

const req = (path: string) => new Request(`http://localhost${path}`)

const takodachi = await Bun.file('public/takodachi.png').text()

describe('Static Plugin', () => {
    it('should get root path', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const res = await app
            .handle(req('/public/takodachi.png'))
            .then((r) => r.blob())
            .then((r) => r.text())

        expect(res).toBe(takodachi)
    })

    it('should get nested path', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const res = await app.handle(req('/public/nested/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi)
    })

    it('should get different path', async () => {
        const app = new Elysia().use(
            staticPlugin({
                assets: 'public-aliased'
            })
        )

        await app.modules

        const res = await app.handle(req('/public/tako.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi)
    })

    it('should handle prefix', async () => {
        const app = new Elysia().use(
            staticPlugin({
                prefix: '/static'
            })
        )

        await app.modules

        const res = await app.handle(req('/static/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi)
    })

    it('should handle empty prefix', async () => {
        const app = new Elysia().use(
            staticPlugin({
                prefix: ''
            })
        )

        await app.modules

        const res = await app.handle(req('/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi)
    })

    it('should supports multiple public', async () => {
        const app = new Elysia()
            .use(
                staticPlugin({
                    prefix: '/public-aliased',
                    assets: 'public-aliased'
                })
            )
            .use(
                staticPlugin({
                    prefix: '/public'
                })
            )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))

        expect(res.status).toBe(200)
    })

    it('ignore string pattern', async () => {
        const app = new Elysia().use(
            staticPlugin({
                ignorePatterns: ['public/takodachi.png']
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe('NOT_FOUND')
    })

    it('ignore regex pattern', async () => {
        const app = new Elysia()
            .use(
                staticPlugin({
                    ignorePatterns: [/takodachi.png$/]
                })
            )

        const file = await app.handle(req('/public/takodachi.png'))

        expect(file.status).toBe(404)
    })

    it('always static', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true
            })
        )

        await app.modules

        const res = await app
            .handle(req('/public/takodachi.png'))
            .then((r) => r.blob())
            .then((r) => r.text())

        expect(res).toBe(takodachi)
    })

    it('exclude extension', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true
            })
        )

        await app.modules

        const res = await app
            .handle(req('/public/takodachi'))
            .then((r) => r.blob())
            .then((r) => r.text())

        expect(res).toBe(takodachi)
    })
})
