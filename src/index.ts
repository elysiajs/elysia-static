import { Elysia, NotFoundError } from 'elysia'

import fastDecodeURI from 'fast-decode-uri-component'

import {
    LRUCache,
    fileExists,
    getBuiltinModule,
    listFiles,
    generateETag,
    isCached,
    getFile,
    isBun,
    listHTMLFiles,
    isNotEmpty
} from './utils'
import type { StaticOptions } from './types'

export async function staticPlugin<const Prefix extends string = '/prefix'>({
    assets = 'public',
    prefix = '/public' as Prefix,
    staticLimit = 1024,
    alwaysStatic = process.env.NODE_ENV === 'production',
    ignorePatterns = ['.DS_Store', '.git', '.env'],
    headers: initialHeaders,
    maxAge = 86400,
    directive = 'public',
    etag: useETag = true,
    extension = true,
    indexHTML = true,
    decodeURI,
    silent,
    enableFallback = false
}: StaticOptions<Prefix> = {}): Promise<Elysia> {
    if (
        typeof process === 'undefined' ||
        typeof process.getBuiltinModule === 'undefined'
    ) {
        if (!silent)
            console.warn(
                '[@elysiajs/static] require process.getBuiltinModule. Static plugin is disabled'
            )

        return new Elysia()
    }

    const builtinModule = getBuiltinModule()
    if (!builtinModule) return new Elysia()

    const [fs, path] = builtinModule

    const fileCache = new LRUCache<string, Response>()

    if (prefix === path.sep) prefix = '' as Prefix
    const assetsDir = path.resolve(assets)
    const shouldIgnore = !ignorePatterns.length
        ? () => false
        : (file: string) =>
              ignorePatterns.find((pattern) =>
                  typeof pattern === 'string'
                      ? pattern.includes(file)
                      : pattern.test(file)
              )

    const app = new Elysia({
        name: 'static',
        seed: prefix
    })

    if (alwaysStatic) {
        const files = await listFiles(path.resolve(assets))

        if (files.length <= staticLimit)
            for (const absolutePath of files) {
                if (!absolutePath || shouldIgnore(absolutePath)) continue

                let relativePath = absolutePath.replace(assetsDir, '')
                if (decodeURI)
                    relativePath = fastDecodeURI(relativePath) ?? relativePath

                let pathName = path.join(prefix, relativePath)

                if (isBun && absolutePath.endsWith('.html')) {
                    const htmlBundle = await import(absolutePath)

                    app.get(pathName, htmlBundle.default)
                    if (indexHTML && pathName.endsWith('/index.html'))
                        app.get(
                            pathName.replace('/index.html', ''),
                            htmlBundle.default
                        )

                    continue
                }

                if (!extension)
                    pathName = pathName.slice(0, pathName.lastIndexOf('.'))

                const file: Awaited<ReturnType<typeof getFile>> = isBun
                    ? getFile(absolutePath)
                    : ((await getFile(absolutePath)) as any)

                if (!file) {
                    if (!silent)
                        console.warn(
                            `[@elysiajs/static] Failed to load file: ${absolutePath}`
                        )

                    return new Elysia()
                }

                const etag = await generateETag(file)

                function handleCache({
                    headers: requestHeaders
                }: {
                    headers: Record<string, string>
                }) {
                    if (etag) {
                        let cached = isCached(
                            requestHeaders as any,
                            etag,
                            absolutePath
                        )

                        if (cached === true)
                            return new Response(null, {
                                status: 304,
                                headers: isNotEmpty(initialHeaders)
                                    ? initialHeaders
                                    : undefined
                            })
                        else if (cached !== false) {
                            const cache = fileCache.get(pathName)
                            if (cache) return cache.clone()

                            return cached.then((cached) => {
                                if (cached)
                                    return new Response(null, {
                                        status: 304,
                                        headers: initialHeaders
                                            ? initialHeaders
                                            : undefined
                                    })

                                const response = new Response(file, {
                                    headers: Object.assign(
                                        {
                                            'Cache-Control': maxAge
                                                ? `${directive}, max-age=${maxAge}`
                                                : directive
                                        },
                                        initialHeaders,
                                        etag ? { Etag: etag } : {}
                                    )
                                })
                                fileCache.set(prefix, response)

                                return response.clone()
                            })
                        }
                    }

                    const cache = fileCache.get(pathName)
                    if (cache) return cache.clone()

                    const response = new Response(file, {
                        headers: Object.assign(
                            {
                                'Cache-Control': maxAge
                                    ? `${directive}, max-age=${maxAge}`
                                    : directive
                            },
                            initialHeaders,
                            etag ? { Etag: etag } : {}
                        )
                    })

                    fileCache.set(pathName, response)

                    return response.clone()
                }

                app.get(
                    pathName,
                    useETag
                        ? (handleCache as any)
                        : new Response(
                              file,
                              isNotEmpty(initialHeaders)
                                  ? {
                                        headers: initialHeaders
                                    }
                                  : undefined
                          )
                )

                if (indexHTML && pathName.endsWith('/index.html'))
                    app.get(
                        pathName.replace('/index.html', ''),
                        useETag
                            ? (handleCache as any)
                            : new Response(
                                  file,
                                  isNotEmpty(initialHeaders)
                                      ? {
                                            headers: initialHeaders
                                        }
                                      : undefined
                              )
                    )
            }

        return app
    }

    if (
        // @ts-ignore private property
        !(`GET_${prefix}/*` in app.routeTree)
    ) {
        if (isBun) {
            const htmls = await listHTMLFiles(path.resolve(assets))

            for (const absolutePath of htmls) {
                if (!absolutePath || shouldIgnore(absolutePath)) continue

                let relativePath = absolutePath.replace(assetsDir, '')
                const pathName = path.join(prefix, relativePath)

                const htmlBundle = await import(absolutePath)

                app.get(pathName, htmlBundle.default)
                if (indexHTML && pathName.endsWith('/index.html'))
                    app.get(
                        pathName.replace('/index.html', ''),
                        htmlBundle.default
                    )
            }
        }

        const serveStaticFile = async (pathName: string, requestHeaders?: Record<string, string | undefined>) => {
            if (shouldIgnore(pathName)) return null

            const cache = fileCache.get(pathName)
            if (cache) return cache.clone()

            const fileStat = await fs.stat(pathName).catch(() => null)
            if (!fileStat) return null

            if (!indexHTML && fileStat.isDirectory()) return null

            let file: NonNullable<Awaited<ReturnType<typeof getFile>>> | undefined

            if (!isBun && indexHTML) {
                const htmlPath = path.join(pathName, 'index.html')
                const cache = fileCache.get(htmlPath)
                if (cache) return cache.clone()

                if (await fileExists(htmlPath))
                    file = await getFile(htmlPath)
            }

            if (!file && !fileStat.isDirectory() && (await fileExists(pathName)))
                file = await getFile(pathName)

            if (!file) return null

            if (!useETag)
                return new Response(
                    file,
                    isNotEmpty(initialHeaders)
                        ? { headers: initialHeaders }
                        : undefined
                )

            const etag = await generateETag(file)
            if (requestHeaders && etag && (await isCached(requestHeaders, etag, pathName)))
                return new Response(null, { status: 304 })

            const response = new Response(file, {
                headers: Object.assign(
                    {
                        'Cache-Control': maxAge
                            ? `${directive}, max-age=${maxAge}`
                            : directive
                    },
                    initialHeaders,
                    etag ? { Etag: etag } : {}
                )
            })

            fileCache.set(pathName, response)
            return response.clone()
        }

        if (enableFallback) {
            app.onError({ as: 'global' }, async ({ code, request }) => {
                if (code !== 'NOT_FOUND') return

                // Only serve static files for GET/HEAD
                if (request.method !== 'GET' && request.method !== 'HEAD') return

                const url = new URL(request.url)
                let pathname = url.pathname

                if (prefix) {
                    if (pathname.startsWith(prefix)) {
                        pathname = pathname.slice(prefix.length)
                    } else {
                        return
                    }
                }

                const rawPath = decodeURI
                    ? (fastDecodeURI(pathname) ?? pathname)
                    : pathname
                const resolvedPath = path.resolve(
                    assetsDir,
                    rawPath.replace(/^\//, '')
                )
                // Block path traversal: must stay under assetsDir
                if (
                    resolvedPath !== assetsDir &&
                    !resolvedPath.startsWith(assetsDir + path.sep)
                )
                    return

                if (shouldIgnore(resolvedPath.replace(assetsDir, ''))) return

                try {
                    const headers = Object.fromEntries(request.headers)
                    return await serveStaticFile(resolvedPath, headers)
                } catch {
                    return
                }
            })
        } else {
            app.onError(() => {}).get(
                `${prefix}/*`,
                async ({ params, headers: requestHeaders }) => {
                    const rawPath = decodeURI
                        ? (fastDecodeURI(params['*']) ?? params['*'])
                        : params['*']
                    const resolvedPath = path.resolve(
                        assetsDir,
                        rawPath.replace(/^\//, '')
                    )
                    if (
                        resolvedPath !== assetsDir &&
                        !resolvedPath.startsWith(assetsDir + path.sep)
                    )
                        throw new NotFoundError()

                    if (shouldIgnore(resolvedPath.replace(assetsDir, '')))
                        throw new NotFoundError()

                    try {
                        const result = await serveStaticFile(
                            resolvedPath,
                            requestHeaders
                        )
                        if (result) return result
                        throw new NotFoundError()
                    } catch (error) {
                        if (error instanceof NotFoundError) throw error
                        if (!silent) console.error(`[@elysiajs/static]`, error)
                        throw new NotFoundError()
                    }
                }
            )
        }
    }

    return app
}

export default staticPlugin
