import type { Elysia } from 'elysia'

import { readdirSync, statSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const getFiles = (dir: string) => {
    let results: string[] = []

    readdirSync(dir).forEach((file) => {
        file = dir + '/' + file
        const stat = statSync(file)

        if (stat && stat.isDirectory()) results = results.concat(getFiles(file))
        else results.push(resolve(dir, file))
    })

    return results
}

export const staticPlugin =
    (
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
    ) =>
    (app: Elysia) => {
        const files = getFiles(resolve(path))

        const shouldIgnore = (file: string) =>
            ignorePatterns.find((pattern) => {
                if (typeof pattern === 'string') return pattern.includes(file)
                else return pattern.test(file)
            })

        if (
            alwaysStatic ||
            (process.env.NODE_ENV === 'production' &&
                files.length <= staticLimit)
        )
            files.forEach((file) => {
                if (shouldIgnore(file)) return

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
            })
        else
            app.get(`${prefix}/*`, ({ params }) => {
                const file = `${path}/${(params as any)['*']}`

                if (shouldIgnore(file))
                    return new Response('NOT_FOUND', {
                        status: 404
                    })

                if (existsSync(file)) return new Response(Bun.file(file))

                return new Response('NOT_FOUND', {
                    status: 404
                })
            })

        return app
    }

export default staticPlugin
