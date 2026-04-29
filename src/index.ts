import { Elysia, ElysiaFile, NotFoundError, type Context } from 'elysia'

import fastDecodeURI from 'fast-decode-uri-component'

import {
    LRUCache,
    fileExists,
    getBuiltinModule,
    listFiles,
    generateETag,
    isCached,
    getFile,
    isBun
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
    detail,
    bunFullstack = false,
    decodeURI,
    silent
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
    const isUnsafeSep = path.sep !== '/'

    const normalizePath = isUnsafeSep
        ? (p: string) => p.replace(/\\/g, '/')
        : (p: string) => p

    const fileCache = new LRUCache<string, ElysiaFile>()

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

    /**
     *
     * Serves `preBundledFile` always, if this argument is passed in
     */
    async function getFileResponse({
        relativeFilePath,
        requestHeaders,
        set,
        preBundledFile
    }: {
        relativeFilePath: string
        requestHeaders: Record<string, string | undefined>
        set: Context['set']
        preBundledFile?: ElysiaFile
    }) {
        const setInitialHeaders = () => {
            for (const [headerName, headerVal] of Object.entries(
                initialHeaders ?? {}
            )) {
                set.headers[headerName] = headerVal
            }
        }

        const finalizeFileResponse = async (
            file: ElysiaFile,
            filePath: string
        ) => {
            setInitialHeaders()

            if (!useETag) return file

            const etag = await generateETag(file)

            if (etag && (await isCached(requestHeaders, etag, filePath)))
                return new Response(null, {
                    status: 304
                })

            set.headers['etag'] = etag
            set.headers['cache-control'] = maxAge
                ? `${directive}, max-age=${maxAge}`
                : directive

            return file
        }

        if (shouldIgnore(relativeFilePath)) throw new NotFoundError()

        const cachedFile = preBundledFile ?? fileCache.get(relativeFilePath)
        if (cachedFile)
            return finalizeFileResponse(cachedFile, relativeFilePath)

        try {
            const fileStat = await fs.stat(relativeFilePath).catch(() => null)
            if (!fileStat) throw new NotFoundError()

            if (!indexHTML && fileStat.isDirectory()) throw new NotFoundError()

            let file:
                | NonNullable<Awaited<ReturnType<typeof getFile>>>
                | undefined

            let cacheKey = relativeFilePath

            if (fileStat.isDirectory() && indexHTML) {
                const htmlPath = path.join(relativeFilePath, 'index.html')
                const cachedFile = fileCache.get(htmlPath)

                if (cachedFile)
                    return finalizeFileResponse(cachedFile, htmlPath)

                if (await fileExists(htmlPath)) {
                    cacheKey = htmlPath
                    file = getFile(htmlPath)
                }
            }

            if (!fileStat.isDirectory()) {
                file = getFile(relativeFilePath)
            }
            if (relativeFilePath.endsWith('.html') && isBun && bunFullstack) {
                throw Error("File should've been pre-bundled!")
            }

            if (!file) throw new NotFoundError()

            fileCache.set(cacheKey, file)

            return finalizeFileResponse(file, cacheKey)
        } catch (error) {
            if (error instanceof NotFoundError) throw error
            if (!silent) console.error(`[@elysiajs/static]`, error)

            throw new NotFoundError()
        }
    }

    const app = new Elysia({
        name: 'static',
        seed: prefix
    })

    const files = await listFiles(path.resolve(assets))

    if (files.length <= staticLimit)
        // mount files as static routes
        for (const absoluteFilePath of files) {
            const shouldBundleFileWithBun =
                isBun && bunFullstack && absoluteFilePath.endsWith('.html')
            if (
                !absoluteFilePath ||
                shouldIgnore(absoluteFilePath) ||
                (!alwaysStatic && !shouldBundleFileWithBun) // if shouldBundleFileWithBun, we pre-bundle the HTML files and add them as routes regardless if alwaysStatic is true or not (matches current implementation)
            )
                continue

            let relativeFilePath = absoluteFilePath.replace(assetsDir, '')
            if (decodeURI)
                relativeFilePath =
                    fastDecodeURI(relativeFilePath) ?? relativeFilePath

            let urlPath = normalizePath(path.join(prefix, relativeFilePath))

            if (!extension)
                urlPath = normalizePath(
                    urlPath.slice(0, urlPath.lastIndexOf('.'))
                )

            if (!(await fileExists(absoluteFilePath))) {
                if (!silent)
                    console.warn(
                        `[@elysiajs/static] Failed to load file: ${absoluteFilePath}`
                    )

                return new Elysia()
            }
            const preBUNdledHTML: ElysiaFile | undefined =
                shouldBundleFileWithBun
                    ? (await import(absoluteFilePath)).default
                    : undefined // pun intended

            app.get(
                urlPath,
                ({ headers, set }) =>
                    getFileResponse({
                        relativeFilePath: absoluteFilePath,
                        requestHeaders: headers,
                        set,
                        preBundledFile: preBUNdledHTML
                    }),
                {
                    detail:
                        typeof detail === 'function' ? detail(urlPath) : detail
                }
            )

            if (indexHTML && urlPath.endsWith('/index.html'))
                app.get(
                    urlPath.replace('/index.html', ''),
                    ({ headers, set }) =>
                        getFileResponse({
                            relativeFilePath: absoluteFilePath,
                            requestHeaders: headers,
                            set,
                            preBundledFile: preBUNdledHTML
                        }),
                    {
                        detail:
                            typeof detail === 'function'
                                ? detail(urlPath.replace('/index.html', ''))
                                : detail
                    }
                )
        }

    // set up catch-all route for static assets
    if (
        // @ts-ignore private property
        !(`GET_${prefix}/*` in app.routeTree) &&
        !alwaysStatic
    ) {
        app.onError(() => {}).get(
            `${prefix.endsWith('/') ? prefix.slice(0, -1) : prefix}/*`,
            ({ params, headers: requestHeaders, set }) =>
                getFileResponse({
                    relativeFilePath: normalizePath(
                        path.join(
                            assets,
                            decodeURI
                                ? (fastDecodeURI(params['*']) ?? params['*'])
                                : params['*']
                        )
                    ),
                    requestHeaders,
                    set
                }),
            {
                detail:
                    typeof detail === 'function'
                        ? detail(
                              `${prefix.endsWith('/') ? prefix.slice(0, -1) : prefix}/*`
                          )
                        : detail
            }
        )
    }

    return app
}

export default staticPlugin
