import { Elysia, ElysiaFile, NotFoundError, type Context } from 'elysia'

import fastDecodeURI from 'fast-decode-uri-component'

import {
    LRUCache,
    fileExists,
    getBuiltinModule,
    listFiles,
    generateETag,
    alreadyCachedDownstream,
    getFile,
    isBun,
    getFileStats
} from './utils'
import type { StaticOptions } from './types'
import { BunFile, HTMLBundle } from 'bun'
import { Stats } from 'fs'

interface CachedFile {
    data: Blob
    stats: Stats
    etag?: string
}

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
    bundleHTML = true,
    bunFullstack,
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
    if (bunFullstack === undefined) {
        bunFullstack = bundleHTML
    }

    const builtinModule = getBuiltinModule()
    if (!builtinModule) return new Elysia()

    const [fs, path] = builtinModule
    const isUnsafeSep = path.sep !== '/'

    const normalizePath = isUnsafeSep
        ? (p: string) => p.replace(/\\/g, '/')
        : (p: string) => p

    const fileCache = new LRUCache<string, CachedFile>()

    if (prefix.endsWith('/')) {
        prefix = prefix.slice(0, -1) as Prefix
    }

    const assetsDir = path.resolve(assets)

    const shouldIgnore = !ignorePatterns.length
        ? () => false
        : (relativeFilePathFromAssetDir: string) => {
              return ignorePatterns?.find((pattern) =>
                  typeof pattern === 'string'
                      ? pattern.includes(relativeFilePathFromAssetDir)
                      : pattern.test(relativeFilePathFromAssetDir)
              )
          }

    const app = new Elysia({
        name: 'static',
        seed: prefix
    })
    app.onError(() => {})

    const files = (await listFiles(assetsDir)).sort((path1, path2) => {
        const isHTML1 = path1.endsWith('.html')
        const isHTML2 = path2.endsWith('.html')
        return +isHTML2 - +isHTML1
    }) // prioritize mounting the html files first, since those must be added (if bunFullstack is true) whether or not we've exceeded staticLimit
    let staticRoutesMounted = 0
    /** whether or not the `prefix` url (no trailing slash, unless the whole url is `/`) was mounted in the below for-loop */
    let rootPathAlreadyMounted = false
    // mount applicable files (HTML files bundled with Bun, or all files if alwaysStatic is true) as static routes
    for (const absoluteFilePath of files) {
        const shouldBundleFileWithBun =
            isBun && bunFullstack && absoluteFilePath.endsWith('.html')

        if (
            !absoluteFilePath ||
            shouldIgnore(absoluteFilePath.replace(assetsDir, '')) ||
            (!alwaysStatic && !shouldBundleFileWithBun) // if shouldBundleFileWithBun, we pre-bundle the HTML files and add them as routes regardless if alwaysStatic is true or not (matches current implementation)
        )
            continue

        if (staticRoutesMounted >= staticLimit && !shouldBundleFileWithBun) {
            // we're skipping this asset, so we'll need the wildcard route generated when alwaysStatic is false
            alwaysStatic = false // we can't mount any more (non-bun HTML) routes
            continue
        }
        if (!(await fileExists(absoluteFilePath))) {
            if (!silent)
                console.warn(
                    `[@elysiajs/static] Failed to load file: ${absoluteFilePath}`
                )

            return new Elysia()
        }
        const urlPath = getURLPath(absoluteFilePath)
        const prebundledHTML = shouldBundleFileWithBun
            ? ((await import(absoluteFilePath)).default as HTMLBundle)
            : undefined

        mountRoute({ urlPath, absoluteFilePath, prebundledHTML })
        staticRoutesMounted++

        if (indexHTML && urlPath.endsWith('/index.html')) {
            const strippedURLPath = urlPath.replace(/\/index.html$/, '')
            mountRoute({
                urlPath: strippedURLPath === '' ? '/' : strippedURLPath,
                absoluteFilePath,
                prebundledHTML
            })
            staticRoutesMounted++

            if (strippedURLPath === prefix) {
                rootPathAlreadyMounted = true
            }
        }
    }

    // set up catch-all route for static assets
    if (
        // @ts-ignore private property
        !(`GET_${prefix}/*` in app.routeTree) &&
        !alwaysStatic
    ) {
        mountRoute({
            urlPath: `${prefix.endsWith('/') ? prefix.slice(0, -1) : prefix}/*`,
            absoluteFilePath: (params) =>
                path.resolve(
                    assets,
                    decodeURI
                        ? (fastDecodeURI(params['*']) ?? params['*'])
                        : params['*']
                )
        })
        if (!rootPathAlreadyMounted) {
            mountRoute({
                urlPath: prefix === '' ? '/' : prefix,
                absoluteFilePath: assetsDir
            }) // /public/* does not catch /public (without the trailing /), so we need another route here in case it serves the top-level index.html file (funnily enough, /* captures /, so we are a bit redundant in that case)
        }
    }

    function mountRoute({
        urlPath,
        absoluteFilePath,
        prebundledHTML
    }: {
        urlPath: string
        absoluteFilePath: string | ((params: any) => string)
        /** if provided, will serve bun HTML file instead of custom handler */
        prebundledHTML?: HTMLBundle
    }) {
        app.get(
            urlPath,
            prebundledHTML !== undefined
                ? prebundledHTML
                : ({ params, headers: requestHeaders, set }) => {
                      return getFileResponse({
                          absoluteFilePath:
                              typeof absoluteFilePath === 'function'
                                  ? absoluteFilePath(params)
                                  : absoluteFilePath,
                          requestHeaders,
                          set
                      })
                  },
            {
                detail: typeof detail === 'function' ? detail(urlPath) : detail
            }
        )
    }
    /** Replaces assetsDir with url prefix */
    function getURLPath(absoluteFilePath: string) {
        let relativeFilePath = absoluteFilePath.replace(assetsDir, '')
        if (decodeURI)
            relativeFilePath =
                fastDecodeURI(relativeFilePath) ?? relativeFilePath

        let urlPath = normalizePath(path.join(prefix, relativeFilePath))

        if (!extension) urlPath = urlPath.slice(0, urlPath.lastIndexOf('.'))
        return urlPath
    }

    /** returns file response given file path and request headers */
    async function getFileResponse({
        absoluteFilePath,
        requestHeaders,
        set
    }: {
        absoluteFilePath: string
        requestHeaders: Record<string, string | undefined>
        set: Context['set']
    }) {
        if (
            absoluteFilePath !== assetsDir &&
            !absoluteFilePath.startsWith(assetsDir + path.sep)
        )
            throw new NotFoundError() // prevent file-traversal attacks

        const setInitialHeaders = () => {
            for (const [headerName, headerVal] of Object.entries(
                initialHeaders ?? {}
            )) {
                set.headers[headerName] = headerVal
            }
        }

        const finalizeResponse = async (file: CachedFile) => {
            setInitialHeaders()
            if (!useETag) return file.data

            if (alreadyCachedDownstream(requestHeaders, file.etag, file.stats))
                return new Response(null, {
                    status: 304
                })

            set.headers['etag'] = file.etag
            set.headers['cache-control'] = maxAge
                ? `${directive}, max-age=${maxAge}`
                : directive
            return file.data
        }

        const cachedFile =
            fileCache.get(absoluteFilePath) ??
            (indexHTML
                ? fileCache.get(path.join(absoluteFilePath, 'index.html')) // eagerly check for /index.html subpath, regardless of whether absoluteFilePath is a directory or not
                : undefined)

        if (cachedFile) {
            return finalizeResponse(cachedFile)
        }

        let fileStat = await getFileStats(absoluteFilePath)
        if (!fileStat) throw new NotFoundError()

        if (fileStat.isDirectory()) {
            if (indexHTML) {
                absoluteFilePath = path.join(absoluteFilePath, 'index.html')
                fileStat = await getFileStats(absoluteFilePath)
            } else {
                throw new NotFoundError()
            }
        }

        if (shouldIgnore(absoluteFilePath.replace(assetsDir, '')))
            throw new NotFoundError()

        if (fileStat === null || fileStat.isDirectory()) {
            throw new NotFoundError()
        }

        try {
            if (absoluteFilePath.endsWith('.html') && isBun && bunFullstack) {
                throw new Error(
                    'Bun HTML files should be served directly as a static route, not requested dynamically'
                )
            } else {
                const file = getFile(absoluteFilePath)
                const cachedFileResponse = isBun
                    ? (file.value as BunFile) // bun does its own magic with these lazy blobs, so we don't need to eagerly load them here
                    : new Blob([await fs.readFile(absoluteFilePath)], {
                          type: file.type // save the content-type here
                      })

                const cachedFile: CachedFile = {
                    data: cachedFileResponse,
                    stats: fileStat,
                    etag: await generateETag(file)
                }
                fileCache.set(absoluteFilePath, cachedFile)
                return finalizeResponse(cachedFile)
            }
        } catch (error) {
            if (error instanceof NotFoundError) throw error
            if (!silent) console.error(`[@elysiajs/static]`, error)

            throw new NotFoundError()
        }
    }

    return app
}

export default staticPlugin
