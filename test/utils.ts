import type { AnyElysia, Server } from 'elysia'

let fs = process.getBuiltinModule('fs/promises')

export const req = (path: string) => new Request(`http://localhost${path}`)
const isBun = typeof Bun !== 'undefined' && !!Bun.file
export const takodachi = isBun
    ? await Bun.file('public/takodachi.png').text()
    : await fs.readFile('public/takodachi.png')

/**
 * Calls `run` with a `request(path)` that answers like `app.handle(req(path))`.
 *
 * `bunFullstack` mounts HTML bundles, which only Bun's native router serves
 * (`app.handle()` answers them with a 500), so on Bun those requests go to a
 * real server on an ephemeral port, stopped once `run` settles
 */
export async function withRequest(
    app: AnyElysia,
    bunFullstack: boolean,
    run: (request: (path: string) => Promise<Response>) => Promise<void>
) {
    if (!bunFullstack || !isBun) return run((path) => app.handle(req(path)))

    // called once the routes, native HTML bundles included, are published
    const server = await new Promise<Server>((resolve) =>
        app.listen(0, resolve)
    )

    try {
        await run((path) => {
            // the URL `req(path)` builds, sent to the server instead
            const url = new URL(req(path).url)
            url.host = server.url.host

            return fetch(url)
        })
    } finally {
        await app.stop(true)
    }
}
