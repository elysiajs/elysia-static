import { Elysia, NotFoundError } from 'elysia'

import fastDecodeURI from 'fast-decode-uri-component'

import {
    fileCache,
    fileExists,
    getBuiltinModule,
    listFiles,
    statCache,
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
    silent
}: StaticOptions<Prefix> = {}): Promise<Elysia> {
    if (
        typeof process === 'undefined' ||
        typeof process.getBuiltinModule === 'undefined'
    ) {
        if (!silent)
            console.warn(
                '@elysiajs/static require process.getBuiltinModule to be available.'
            )

        return new Elysia()
    }

    const builtinModule = getBuiltinModule()
    if (!builtinModule) return new Elysia()

    const [fs, path] = builtinModule

    if (prefix === path.sep) prefix = '' as Prefix

    const assetsDir = assets[0] === path.sep ? assets : path.resolve(assets)

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
                    const headers: Record<string, string> = initialHeaders
                        ? Object.assign({}, initialHeaders)
                        : Object.create(null)

                    if (etag) {
                        let cached = isCached(
                            requestHeaders as any,
                            etag,
                            absolutePath
                        )

                        if (cached === true)
                            return new Response(null, {
                                status: 304,
                                headers
                            })
                        else if (cached !== false)
                            return cached.then((cached) => {
                                if (cached)
                                    return new Response(null, {
                                        status: 304,
                                        headers
                                    })

                                if (etag) headers['Etag'] = etag
                                headers['Cache-Control'] = maxAge
                                    ? `${directive}, max-age=${maxAge}`
                                    : directive

                                return new Response(file, headers)
                            })
                    }

                    if (etag) headers['Etag'] = etag
                    headers['Cache-Control'] = maxAge
                        ? `${directive}, max-age=${maxAge}`
                        : directive

                    return new Response(file, { headers })
                }

                app.get(
                    pathName,
                    useETag
                        ? (handleCache as any)
                        : new Response(file, {
                              headers: initialHeaders
                          })
                )

                if (indexHTML && pathName.endsWith('/index.html'))
                    app.get(
                        pathName.replace('/index.html', ''),
                        useETag
                            ? (handleCache as any)
                            : new Response(file, {
                                  headers: initialHeaders
                              })
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

        app.onError(() => {}).get(
            `${prefix}/*`,
            async ({ params, headers: requestHeaders }) => {
                const headers = Object.assign({}, initialHeaders)

                const pathName = path.join(
                    assets,
                    decodeURI
                        ? (fastDecodeURI(params['*']) ?? params['*'])
                        : params['*']
                )

                if (shouldIgnore(pathName)) throw new NotFoundError()

                try {
                    let fileStat = statCache.get(pathName)
                    if (!fileStat)
                        try {
                            fileStat = await fs.stat(pathName)
                            statCache.set(pathName, fileStat)
                        } catch {
                            throw new NotFoundError()
                        }

                    if (!indexHTML && fileStat.isDirectory())
                        throw new NotFoundError()

                    let file = fileCache.get(pathName)
                    if (!file) {
                        if (!isBun && indexHTML) {
                            const htmlPath = path.join(pathName, 'index.html')
                            file = fileCache.get(htmlPath)

                            if (!file && (await fileExists(htmlPath)))
                                file = await getFile(htmlPath)
                        }

                        if (
                            !file &&
                            !fileStat.isDirectory() &&
                            (await fileExists(pathName))
                        )
                            file = await getFile(pathName)
                        else throw new NotFoundError()
                    }

                    if (!useETag) {
                        if (isNotEmpty(headers)) return new Response(file)

                        return new Response(file, {
                            headers
                        })
                    }

                    const etag = await generateETag(file)
                    if (
                        etag &&
                        (await isCached(requestHeaders, etag, pathName))
                    )
                        return new Response(null, {
                            status: 304
                        })

                    if (etag) headers['Etag'] = etag
                    headers['Cache-Control'] = maxAge
                        ? `${directive}, max-age=${maxAge}`
                        : directive

                    return new Response(file, {
                        headers
                    })
                } catch (error) {
                    if (error instanceof NotFoundError) throw error
                    if (!silent) console.error(`[@elysiajs/static]`, error)

                    throw new NotFoundError()
                }
            }
        )
    }

    return app
}

export default staticPlugin
