import { Elysia } from 'elysia'
import { staticPlugin } from '../src'

import { describe, expect, it } from 'bun:test'
import { join } from "path";

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
        const app = new Elysia({ forceErrorEncapsulation: true }).use(
            staticPlugin({
                ignorePatterns: ['public/takodachi.png']
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))
        expect(res.status).toBe(404)
    })

    it('ignore regex pattern', async () => {
        const app = new Elysia().use(
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

    it('always static with assets on an absolute path', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                assets: join(import.meta.dir, '../public')
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi)
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

    it('return custom headers', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true,
                headers: {
                    ['x-powered-by']: 'Takodachi'
                }
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('x-powered-by')).toBe('Takodachi')
        expect(res.status).toBe(200)
    })

    it('call onError when using dynamic mode', async () => {
        let called = false

        const app = new Elysia()
            .onError(({ code }) => {
                if (code === 'NOT_FOUND') called = true
            })
            .use(
                staticPlugin({
                    alwaysStatic: false
                })
            )

        await app.modules

        await app.handle(req('/public/not-found'))

        expect(called).toBe(true)
    })

    it('return etag header', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe('ZGe9eXgawZBlMox8sZg82Q==')
        expect(res.status).toBe(200)
    })

    it('return no etag header when noCache', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true,
                noCache: true
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe(null)
        expect(res.status).toBe(200)
    })

    it('return not modified response (etag)', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true
            })
        )

        await app.modules

        const request = req('/public/takodachi')
        request.headers.append('If-None-Match', 'ZGe9eXgawZBlMox8sZg82Q==')

        const res = await app.handle(request)

        expect(res.body).toBe(null)
        expect(res.status).toBe(304)
    })

    it('return not modified response (time)', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true
            })
        )

        await app.modules

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        const request = req('/public/takodachi')
        request.headers.append('If-Modified-Since', tomorrow.toString())

        const res = await app.handle(request)

        expect(res.body).toBe(null)
        expect(res.status).toBe(304)
    })

    it('return ok response when noCache', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                noExtension: true,
                noCache: true
            })
        )

        await app.modules

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        const request = req('/public/takodachi')
        request.headers.append('If-None-Match', 'ZGe9eXgawZBlMox8sZg82Q==')
        request.headers.append('If-Modified-Since', tomorrow.toString())

        const res = await app.handle(request)

        expect(res.status).toBe(200)
    })
  
    it('should 404 when navigate to folder', async () => {

        const app = new Elysia().use(staticPlugin())

        await app.modules

        const notFoundPaths = [
            '/public',
            '/public/',
            '/public/nested',
            '/public/nested/'
        ]

        for (const path of notFoundPaths) {
            const res = await app.handle(req(path))

            expect(res.status).toBe(404)
        }
    })
})
