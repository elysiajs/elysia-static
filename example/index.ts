import { Elysia } from 'elysia'
import { staticPlugin } from '../src/index'

const app = new Elysia().use(await staticPlugin()).listen(3000)

await app.modules
