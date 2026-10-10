// Serves one file, then has nothing left to do: the process must exit on its
// own, so nothing the plugin leaves behind (the file cache sweep) may hold it
import { Elysia } from 'elysia'
import { staticPlugin } from '../../src'

const app = new Elysia().use(staticPlugin())
await app.modules

const res = await app.handle(
    new Request('http://localhost/public/takodachi.png')
)
await res.arrayBuffer()

console.log(res.status)
