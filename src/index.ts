import type { Elysia } from 'elysia'

import { readdir, stat } from 'fs/promises'
import { resolve, join } from 'path'

const getFiles = async (dir: string): Promise<string[]> => {
    const files = await readdir(dir)

    const all = await Promise.all(
        files.map(async (name) => {
            const file = dir + '/' + name
            const stats = await stat(file)

            return stats && stats.isDirectory()
                ? await getFiles(file)
                : [resolve(dir, file)]
        })
    )

    return all.flat()
}

export const staticPlugin = async (
    {
        path = 'public',
        prefix = '/public',
        staticLimit = 1024,
        alwaysStatic = false,
        ignorePatterns = [],
        noExtension = false
    }: {
        /**
         * @default "public"
         *
         * Path to expose as public path
         */
        path?: string
        /**
         * @default '/public'
         *
         * Path prefix to create virtual mount path for the static directory
         */
        prefix?: string
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
         * If set to true, file will always use static path instead
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
    } = {
        path: 'public',
        prefix: '/public',
        staticLimit: 1024,
        alwaysStatic: process.env.NODE_ENV === 'production',
        ignorePatterns: [],
        noExtension: false
    }
) => {
    const files = await getFiles(resolve(path))

    const shouldIgnore = (file: string) => {
        if (!ignorePatterns.length) return false

        return ignorePatterns.find((pattern) => {
            if (typeof pattern === 'string') return pattern.includes(file)
            else return pattern.test(file)
        })
    }

    return (app: Elysia) => {
        if (
            alwaysStatic ||
            (process.env.NODE_ENV === 'production' &&
                files.length <= staticLimit)
        )
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                if (shouldIgnore(file)) continue

                const response = new Response(Bun.file(file))
                let fileName = file
                    .replace(resolve(), '')
                    .replace(`${path}/`, '')

                if (noExtension) {
                    const temp = fileName.split('.')
                    temp.splice(-1)

                    fileName = temp.join('.')
                }

                app.get(join(prefix, fileName), () => response.clone())
            }
        else
            app.get(`${prefix}/*`, (c) => {
                const file = `${path}/${(c.params as any)['*']}`

                if (shouldIgnore(file))
                    return new Response('NOT_FOUND', {
                        status: 404
                    })

                return stat(file)
                    .then((status) => new Response(Bun.file(file)))
                    .catch(
                        (error) =>
                            new Response('NOT_FOUND', {
                                status: 404
                            })
                    )
            })

        return app
    }
}

export default staticPlugin
