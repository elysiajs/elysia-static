import { Elysia, NotFoundError } from 'elysia'

import { readdir, stat } from 'fs/promises'
import {  resolve, resolve as resolveFn, join } from 'path'
import Cache from 'node-cache'

import { generateETag, isCached } from './cache'
import { Stats } from 'fs'

const fileExists = (path: string) => stat(path).then(() => true, () => false)

const statCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const fileCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const htmlCache = new Cache({
    useClones: false,
    checkperiod: 5 * 60,
    stdTTL: 3 * 60 * 60,
    maxKeys: 250
})

const listFiles = async (dir: string): Promise<string[]> => {
    const files = await readdir(dir)

    const all = await Promise.all(
        files.map(async (name) => {
            const file = dir + '/' + name
            const stats = await stat(file)

            return stats && stats.isDirectory()
                ? await listFiles(file)
                : [resolve(dir, file)]
        })
    )

    return all.flat()
}

export const staticPlugin = async <Prefix extends string = '/prefix'>(
    {
        assets = 'public',
        prefix = '/public' as Prefix,
        staticLimit = 1024,
        alwaysStatic = false,
        ignorePatterns = ['.DS_Store', '.git', '.env'],
        noExtension = false,
        enableDecodeURI = false,
        resolve = resolveFn,
        headers = {},
        noCache = false,
        indexHTML = true
    }: {
        /**
         * @default "public"
         *
         * Asset path to expose as public path
         */
        assets?: string
        /**
         * @default '/public'
         *
         * Path prefix to create virtual mount path for the static directory
         */
        prefix?: Prefix
        /**
         * @default 1024
         *
         * If total files exceed this number,
         * file will be handled via wildcard instead of static route
         * to reduce memory usage
         */
        staticLimit?: number
        /**
         * @default false
         *
         * Should file always be served statically
         */
        alwaysStatic?: boolean
        /**
         * @default [] `Array<string | RegExp>`
         *
         * Array of file to ignore publication.
         * If one of the patters is matched,
         * file will not be exposed.
         */
        ignorePatterns?: Array<string | RegExp>
        /**
         * Indicate if file extension is required
         *
         * Only works if `alwaysStatic` is set to true
         */
        noExtension?: boolean
        /**
         *
         * When url needs to be decoded
         *
         * Only works if `alwaysStatic` is set to false
         */
        enableDecodeURI?: boolean
        /**
         * Nodejs resolve function
         */
        resolve?: (...pathSegments: string[]) => string
        /**
         * Set headers
         */
        headers?: Record<string, string> | undefined
        /**
         * @default false
         *
         * If set to true, browser caching will be disabled
         */
        noCache?: boolean
        /**
         * @default true
         *
         * Enable serving of index.html as default / route
         */
        indexHTML?: boolean
    } = {
        assets: 'public',
        prefix: '/public' as Prefix,
        staticLimit: 1024,
        alwaysStatic: process.env.NODE_ENV === 'production',
        ignorePatterns: [],
        noExtension: false,
        enableDecodeURI: false,
        resolve: resolveFn,
        headers: {},
        noCache: false,
        indexHTML: true
    }
) => {
    const files = await listFiles(resolveFn(assets))

    if (prefix === '/') prefix = '' as Prefix

    const shouldIgnore = (file: string) => {
        if (!ignorePatterns.length) return false

        return ignorePatterns.find((pattern) => {
            if (typeof pattern === 'string') return pattern.includes(file)
            else return pattern.test(file)
        })
    }

    const app = new Elysia({
        name: 'static',
        seed: {
            assets,
            prefix,
            staticLimit,
            alwaysStatic,
            ignorePatterns,
            noExtension,
            resolve: resolve.toString(),
            headers,
            noCache,
            indexHTML
        }
    })

    if (
        alwaysStatic ||
        (process.env.ENV === 'production' && files.length <= staticLimit)
    )
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i]
            if (!filePath || shouldIgnore(filePath)) continue

            let fileName = filePath
                .replace(resolve(), '')
                .replace(`${assets}/`, '')

            if (noExtension) {
                const temp = fileName.split('.')
                temp.splice(-1)

                fileName = temp.join('.')
            }

            const file = Bun.file(filePath)
            const etag = await generateETag(file)

            app.get(
                join(prefix, fileName),
                noCache
                    ? new Response(file, {
                          headers
                      })
                    : async ({ headers: reqHeaders }) => {
                          if (await isCached(reqHeaders, etag, filePath)) {
                              return new Response(null, {
                                  status: 304,
                                  headers
                              })
                          }

                          headers['Etag'] = etag
                          headers['Cache-Control'] = 'public, max-age=0'

                          return new Response(file, {
                              headers
                          })
                      }
            )

            if (indexHTML && fileName.endsWith('/index.html'))
                app.get(
                    join(prefix, fileName.replace('/index.html', '')),
                    noCache
                        ? new Response(file, {
                              headers
                          })
                        : async ({ headers: reqHeaders }) => {
                              if (await isCached(reqHeaders, etag, filePath)) {
                                  return new Response(null, {
                                      status: 304,
                                      headers
                                  })
                              }

                              headers['Etag'] = etag
                              headers['Cache-Control'] = 'public, max-age=0'

                              return new Response(file, {
                                  headers
                              })
                          }
                )
        }
    else {
        if (
            !app.router.history.find(
                ({ method, path }) => path === `${prefix}/*` && method === 'GET'
            )
        )
            app.onError(() => {}).get(
                `${prefix}/*`,
                async ({ params, headers: reqHeaders }) => {
                    const path = enableDecodeURI
                        ? decodeURI(`${assets}/${decodeURI(params['*'])}`)
                        : `${assets}/${params['*']}`

                    if (shouldIgnore(path)) throw new NotFoundError()

                    try {
                        let status = statCache.get<Stats>(path)
                        if (!status) {
                            status = await stat(path)
                            statCache.set(path, status)
                        }

                        let file =
                            fileCache.get<ReturnType<(typeof Bun)['file']>>(
                                path
                            )

                        if (!file) {
                            if (status.isDirectory()) {
                                let hasCache = false

                                if (
                                    indexHTML &&
                                    (hasCache =
                                        htmlCache.get<boolean>(
                                            `${path}/index.html`
                                        ) ??
                                        (await fileExists(`${path}/index.html`)))
                                ) {
                                    if (hasCache === undefined)
                                        htmlCache.set(
                                            `${path}/index.html`,
                                            true
                                        )

                                    file = Bun.file(`${path}/index.html`)
                                } else {
                                    if (indexHTML && hasCache === undefined)
                                        htmlCache.set(
                                            `${path}/index.html`,
                                            false
                                        )

                                    throw new NotFoundError()
                                }
                            }

                            file ??= Bun.file(path)
                            fileCache.set(path, file)
                        }

                        if (noCache)
                            return new Response(file, {
                                headers
                            })

                        const etag = await generateETag(file)
                        if (await isCached(reqHeaders, etag, path))
                            return new Response(null, {
                                status: 304,
                                headers
                            })

                        headers['Etag'] = etag
                        headers['Cache-Control'] = 'public, max-age=0'

                        return new Response(file, {
                            headers
                        })
                    } catch (error) {
                        throw new NotFoundError()
                    }
                }
            )
    }

    return app
}

export default staticPlugin
