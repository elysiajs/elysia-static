import { Elysia } from 'elysia'
import { bench, run } from 'mitata'

const response = new Response(Bun.file('public/takodachi.png'))

const app = new Elysia()
    .get('/clone', () => response.clone())
    .get('/inline', () => new Response(Bun.file('public/takodachi.png')))

bench("clone", () => response.clone())
bench("inline", () => new Response(Bun.file('public/takodachi.png')))

run()
