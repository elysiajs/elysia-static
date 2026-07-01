import { Elysia, NotFound } from 'elysia'
import { staticPlugin } from '../src'

import { expect, it, describe } from 'vitest'
import { join, sep } from 'path'

import { req, takodachi } from './utils'

describe('Static Plugin', () => {
    it('should get root path', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const res = await app
            .handle(req('/public/takodachi.png'))
            .then((r) => r.blob())
            .then((r) => r.text())

        expect(res).toBe(takodachi.toString())
    })

    it('should get nested path', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const res = await app.handle(req('/public/nested/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toBe(takodachi.toString())
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
        expect(await blob.text()).toBe(takodachi.toString())
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
        expect(await blob.text()).toBe(takodachi.toString())
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
        expect(await blob.text()).toBe(takodachi.toString())
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
                ignorePatterns: [`public${sep}takodachi.png`]
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))
        expect(res.status).toBe(404)
    })
    it('ignore string pattern (when alwaysStatic is true)', async () => {
        const app = new Elysia().use(
            staticPlugin({
                ignorePatterns: [`public${sep}takodachi.png`],
                alwaysStatic: true
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

        expect(res).toBe(takodachi.toString())
    })

    it('always static with assets on an absolute path', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                assets: join(
                    import.meta.dir ?? join(expect.getState().testPath!, '../'),
                    '../public'
                )
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))
        const blob = await res.blob()
        expect(await blob.text()).toEqual(takodachi.toString())
    })

    it('exclude extension', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false
            })
        )

        await app.modules

        const res = await app
            .handle(req('/public/takodachi'))
            .then((r) => r.blob())
            .then((r) => r.text())

        expect(res).toBe(takodachi.toString())
    })

    it('return custom headers', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false,
                headers: {
                    'x-powered-by': 'Takodachi'
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
            .error(NotFound, () => {
                called = true
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
                extension: false
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe('ZGe9eXgawZBlMox8sZg82Q==')
        expect(res.status).toBe(200)
    })

    it('return no etag header when etag is false', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false,
                etag: false
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Etag')).toBe(null)
        expect(res.status).toBe(200)
    })

    it('return Cache-Control header when maxAge is set', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false,
                maxAge: 3600
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
        expect(res.status).toBe(200)
    })

    it('return Cache-Control header when maxAge is not set', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi'))

        expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')
        expect(res.status).toBe(200)
    })

    it('skip Cache-Control header when maxAge is null', async () => {
        const app = new Elysia().use(
            staticPlugin({
                maxAge: null
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))

        expect(res.headers.get('Cache-Control')).toBe('public')
        expect(res.status).toBe(200)
    })

    it('set cache directive', async () => {
        const app = new Elysia().use(
            staticPlugin({
                directive: 'private'
            })
        )

        await app.modules

        const res = await app.handle(req('/public/takodachi.png'))

        expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400')
        expect(res.status).toBe(200)
    })

    it('return not modified response (etag)', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false
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
                extension: false
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

    it('return ok response when etag is false', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false,
                etag: false
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

    it.each([
        { bunFullstack: true, alwaysStatic: true },
        { bunFullstack: false, alwaysStatic: true },
        { bunFullstack: true, alwaysStatic: false },
        { bunFullstack: false, alwaysStatic: false }
    ])(
        'should work on all possible index.html paths',
        async ({ bunFullstack, alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({
                    assets: 'public',
                    prefix: 'public',
                    indexHTML: true,
                    bunFullstack,
                    alwaysStatic
                })
            )

            await app.modules
            const htmlPaths = [
                '/public/html',
                '/public/html/',
                '/public/html/index.html',
                '/public/html/index.html/'
            ]

            for (const path of htmlPaths) {
                // console.log(path)
                const res = await app.handle(req(path))
                await (await res.blob()).text() // make sure content is readable and does not lock server-side Response object

                expect(res.status).toBe(200)
            }
        }
    )
    it.each([
        { bunFullstack: true, alwaysStatic: true },
        { bunFullstack: false, alwaysStatic: true },
        { bunFullstack: true, alwaysStatic: false },
        { bunFullstack: false, alwaysStatic: false }
    ])(
        'should 404 on root path when indexHTML is false',
        async ({ bunFullstack, alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({
                    assets: 'public',
                    prefix: 'public',
                    indexHTML: false,
                    bunFullstack,
                    alwaysStatic
                })
            )

            await app.modules
            const htmlPaths = [
                '/public/html/index.html',
                '/public/html/index.html/'
            ]

            for (const path of htmlPaths) {
                // console.log(path)
                const res = await app.handle(req(path))
                await (await res.blob()).text() // make sure content is readable and does not lock server-side Response object

                expect(res.status).toBe(200)
            }
            for (const invalidPath of ['/public/html', '/public/html/']) {
                const res = await app.handle(req(invalidPath))

                expect(res.status).toBe(404)
            }
        }
    )
    it.each([
        { bunFullstack: true, alwaysStatic: true },
        { bunFullstack: false, alwaysStatic: true },
        { bunFullstack: true, alwaysStatic: false },
        { bunFullstack: false, alwaysStatic: false }
    ])(
        'should work on all possible index.html paths (index.html is in root asset dir)',
        async ({ bunFullstack, alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({
                    assets: 'public/html',
                    prefix: '',
                    indexHTML: true,
                    bunFullstack,
                    alwaysStatic
                })
            )

            await app.modules
            const htmlPaths = ['', '/', '/index.html', '/index.html/']

            for (const path of htmlPaths) {
                const res = await app.handle(req(path))
                expect(res.status).toBe(200)
            }
        }
    )

    it('serve index.html to default /', async () => {
        const app = new Elysia().use(staticPlugin())
        await app.modules

        let res = await app.handle(req('/public'))
        expect(res.status).toBe(404)

        res = await app.handle(req('/public/html'))
        expect(res.status).toBe(200)
    })

    it('does not serve index.html to default / when not indexHTML', async () => {
        const app = new Elysia().use(
            staticPlugin({
                indexHTML: false
            })
        )
        await app.modules

        let res = await app.handle(req('/public'))
        expect(res.status).toBe(404)

        res = await app.handle(req('/public/html'))
        expect(res.status).toBe(404)
    })

    it('serves index.html to default / when alwaysStatic', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true
            })
        )
        await app.modules

        let res = await app.handle(req('/public'))
        expect(res.status).toBe(404)

        res = await app.handle(req('/public/html'))
        expect(res.status).toBe(200)
    })

    it('does not serve index.html to default / when alwaysStatic and not indexHTML', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                indexHTML: false
            })
        )
        await app.modules

        let res = await app.handle(req('/public'))
        expect(res.status).toBe(404)

        res = await app.handle(req('/public/html'))
        expect(res.status).toBe(404)
    })

    it('accept detail', async () => {
        const app = new Elysia().use(
            staticPlugin({
                detail: {
                    hide: false
                }
            })
        )
        await app.modules

        for (const route of app.routes) {
            expect(route.hooks.detail.hide).toBe(false)
        }
    })
    it('should return necessary content-type headers', async () => {
        const app = new Elysia().use(
            staticPlugin({
                detail: {
                    hide: false
                },
                headers: {
                    hii: 'uwa'
                }
            })
        )
        await app.modules

        const jsFile = await app.handle(req('/public/js/index.js'))
        expect(jsFile.headers.get('content-type')).toContain('/javascript') // slightly different content-type depending on Bun vs. Node runtime
        expect(jsFile.headers.get('hii')).toEqual('uwa')
    })

    it('preserves content-type on cached file responses', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/js/index.js'))
        expect(first.status).toBe(200)
        expect(first.headers.get('content-type')).toContain('/javascript')

        const second = await app.handle(req('/public/js/index.js'))
        expect(second.status).toBe(200)
        expect(second.headers.get('content-type')).toContain('/javascript')
    })

    it('preserves custom headers on cached file responses', async () => {
        const app = new Elysia().use(
            staticPlugin({
                headers: {
                    'x-static-test': 'cached'
                }
            })
        )

        await app.modules

        const first = await app.handle(req('/public/takodachi.png'))
        expect(first.status).toBe(200)
        expect(first.headers.get('x-static-test')).toBe('cached')

        const second = await app.handle(req('/public/takodachi.png'))
        expect(second.status).toBe(200)
        expect(second.headers.get('x-static-test')).toBe('cached')
    })

    it('preserves etag and cache-control headers on cached file responses', async () => {
        const app = new Elysia().use(
            staticPlugin({
                maxAge: 3600,
                directive: 'private'
            })
        )

        await app.modules

        const first = await app.handle(req('/public/takodachi.png'))
        expect(first.status).toBe(200)

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()
        expect(first.headers.get('cache-control')).toBe('private, max-age=3600')

        const second = await app.handle(req('/public/takodachi.png'))
        expect(second.status).toBe(200)
        expect(second.headers.get('etag')).toBe(etag)
        expect(second.headers.get('cache-control')).toBe(
            'private, max-age=3600'
        )
    })

    it('returns 304 for if-none-match after the file has been cached', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/takodachi.png'))
        expect(first.status).toBe(200)

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()

        const request = req('/public/takodachi.png')
        request.headers.set('if-none-match', etag!)

        const second = await app.handle(request)

        expect(second.status).toBe(304)
        expect(second.body).toBe(null)
    })

    it('does not return 304 when cache-control no-cache is sent after file is cached', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/takodachi.png'))
        expect(first.status).toBe(200)

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()

        const request = req('/public/takodachi.png')
        request.headers.set('if-none-match', etag!)
        request.headers.set('cache-control', 'no-cache')

        const second = await app.handle(request)

        expect(second.status).toBe(200)
        expect(await second.blob().then((b) => b.text())).toBe(
            takodachi.toString()
        )
    })

    it('returns 304 for if-none-match after cached alwaysStatic route response', async () => {
        const app = new Elysia().use(
            staticPlugin({
                alwaysStatic: true,
                extension: false
            })
        )

        await app.modules

        const first = await app.handle(req('/public/takodachi'))
        expect(first.status).toBe(200)

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()

        const request = req('/public/takodachi')
        request.headers.set('if-none-match', etag!)

        const second = await app.handle(request)

        expect(second.status).toBe(304)
        expect(second.body).toBe(null)
    })

    it('serves index.html from cache with content-type and cache headers', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/html'))
        expect(first.status).toBe(200)
        expect(first.headers.get('content-type')).toContain('text/html')

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()
        expect(first.headers.get('cache-control')).toBe('public, max-age=86400')

        const second = await app.handle(req('/public/html'))
        expect(second.status).toBe(200)
        expect(second.headers.get('content-type')).toContain('text/html')
        expect(second.headers.get('etag')).toBe(etag)
        expect(second.headers.get('cache-control')).toBe(
            'public, max-age=86400'
        )
    })

    it('returns 304 for cached index.html default route', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/html'))
        expect(first.status).toBe(200)

        const etag = first.headers.get('etag')
        expect(etag).toBeTruthy()

        const request = req('/public/html')
        request.headers.set('if-none-match', etag!)

        const second = await app.handle(request)

        expect(second.status).toBe(304)
        expect(second.body).toBe(null)
    })

    it('preserves image content-type on cached PNG file responses', async () => {
        const app = new Elysia().use(staticPlugin())

        await app.modules

        const first = await app.handle(req('/public/takodachi.png'))
        expect(first.status).toBe(200)
        expect(first.headers.get('content-type')).toContain('image/png')

        const second = await app.handle(req('/public/takodachi.png'))
        expect(second.status).toBe(200)
        expect(second.headers.get('content-type')).toContain('image/png')
    })

    it.each([
        { bunFullstack: true, alwaysStatic: true },
        { bunFullstack: false, alwaysStatic: true },
        { bunFullstack: true, alwaysStatic: false },
        { bunFullstack: false, alwaysStatic: false }
    ])(
        'suppresses etag and cache-control on cached file responses when etag is false',
        async ({ bunFullstack, alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({ etag: false, alwaysStatic, bunFullstack })
            )

            await app.modules

            const first = await app.handle(req('/public/takodachi.png'))
            expect(first.status).toBe(200)
            expect(first.headers.get('etag')).toBeNull()
            expect(first.headers.get('cache-control')).toBeNull()

            const second = await app.handle(req('/public/takodachi.png'))
            expect(second.status).toBe(200)
            expect(second.headers.get('etag')).toBeNull()
            expect(second.headers.get('cache-control')).toBeNull()
        }
    )
    describe.each([
        { bunFullstack: true, alwaysStatic: true },
        { bunFullstack: false, alwaysStatic: true },
        { bunFullstack: true, alwaysStatic: false },
        { bunFullstack: false, alwaysStatic: false }
    ])('', ({ bunFullstack, alwaysStatic }) => {
        let prevRouteCount = 0 // should expect to be non-decreasing as staticLimit increases
        it.each([...Array(20)].map((_, i) => i))(
            'test static limit',
            async (staticLimit) => {
                const app = new Elysia().use(
                    staticPlugin({
                        assets: 'public',
                        prefix: '',
                        indexHTML: true,
                        bunFullstack,
                        alwaysStatic,
                        staticLimit
                    })
                )

                await app.modules
                const allPaths = [
                    '/html',
                    '/html/',
                    '/html/index.html',
                    '/html/index.html/',
                    '/html/a.html/',
                    '/js/index.js',
                    '/takodachi.png',
                    '/takodachi.png/',
                    '/nested/takodachi.png',
                    '\\nested\\takodachi.png'
                ]
                // console.log(staticLimit, app.routes.length)
                expect(app.routes.length).toBeGreaterThanOrEqual(
                    prevRouteCount - 1
                ) // you may end up with a decrease of 1 when the last static route gets mounted and the two catch-all routes are no-longer needed. Bit scuffed test.
                prevRouteCount = app.routes.length
                for (const path of allPaths) {
                    const res = await app.handle(req(path))
                    expect(res.status).toBe(200)
                }
                for (const nonExistentPath of ['/', 'hi/ok', 'owo', '///']) {
                    const res = await app.handle(req(nonExistentPath))
                    expect(res.status).toBe(404)
                }
            }
        )
    })
    it.each([{ alwaysStatic: true }, { alwaysStatic: false }])(
        'range request header',
        async ({ alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({
                    assets: 'public',
                    prefix: '',
                    indexHTML: true,
                    alwaysStatic
                })
            )

            await app.modules
            const request = req('/html')
            request.headers.set('range', 'bytes=0-1')
            const res = await app.handle(request)
            expect(res.status).toBe(206) // partial request
            expect((await res.bytes()).length).toBe(2)
        }
    )
    it.each([{ alwaysStatic: true }, { alwaysStatic: false }])(
        'range request header on video',
        async ({ alwaysStatic }) => {
            const app = new Elysia().use(
                staticPlugin({
                    assets: 'public',
                    prefix: '',
                    indexHTML: true,
                    alwaysStatic
                })
            )

            await app.modules
            const request = req('/kyuukurarin.mp4')
            request.headers.set('range', 'bytes=37158912-')
            const res = await app.handle(request)
            expect(res.status).toBe(206) // partial request
            expect((await res.bytes()).length).toBe(3220118)
        }
    )
    it("doesn't allow path traversal attacks", async () => {
        const app = new Elysia().use(
            staticPlugin({
                assets: 'public',
                prefix: '',
                decodeURI: true // does have to be set as true
            })
        )

        await app.modules
        const request = req('/..%2Fsrc/index.ts')
        const res = await app.handle(request)
        expect(res.status).toBe(404)
    })
    it('allows custom headers when etag is false and alwaysStatic is true', async () => {
        const app = new Elysia().use(
            staticPlugin({
                assets: 'public',
                prefix: '',
                etag: false,
                headers: {
                    custom: 'hi'
                },
                alwaysStatic: true
            })
        )

        await app.modules
        const request = req('/kyuukurarin.mp4')
        const res = await app.handle(request)
        expect(res.status).toBe(200)
        expect(res.headers.get('custom')).toBe('hi')
    })
})
