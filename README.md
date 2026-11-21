# @elysia/static
[Elysia](https://github.com/elysiajs/elysia) plugin for serving static files.

## Installation
```bash
bun add @elysia/static
```

## Example
```typescript
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysia/static'

const app = new Elysia()
    .use(staticPlugin())
    .listen(3000)
```

## Config
Below is an available config for a static plugin.

### assets
@default "public"

Asset path to expose as a public path

### prefix
@default '/public'

Path prefix to create a virtual mount path for the static directory

### staticLimit
@defualt 1024

If total files exceed this number, the file will be handled via wildcard instead of the static route to reduce memory usage

### alwaysStatic
@default boolean

If set to true, the file will always use a static path instead

See [documentation](https://elysiajs.com/plugins/static) for more details.
