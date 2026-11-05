# @elysia/static
[Elysia](https://github.com/saltyaom/elysia) plugin for serving static files.

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

### ignorePatterns
@default []

List of files to ignore from serving as static files

### prefix
@default '/public'

Path prefix to create a virtual mount path for the static directory

### staticLimit
@defualt 1024

If total files exceed this number, the file will be handled via wildcard instead of the static route to reduce memory usage

### alwaysStatic
@default boolean

If set to true, the plugin will mount around at most `staticLimit` routes before defaulting to wildcard. If false, all routes will go under the wildcard route, with the exclusion of any HTML files bundled by Bun.

### ignorePatterns
@default [] `Array<string | RegExp>`

Array of file to ignore publication. If one of the patters is matched, file will not be exposed.

### extension
@default true

Indicates if file extension is required in URL request

Only works if `alwaysStatic` is set to true

### headers
@default {}

Set response headers of files

### etag
@default true

If set to false, browser caching will be disabled

### directive

@default public

directive for Cache-Control header

@see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#directives

### maxAge

@default 86400

Specifies the maximum amount of time in seconds, a resource will be considered fresh.
This freshness lifetime is calculated relative to the time of the request.
This setting helps control browser caching behavior.
A `maxAge` of 0 will prevent caching, requiring requests to validate with the server before use.
 

### indexHTML
@default false

If set to true, any index.html file served at https://host.com/\*\*/index.html will also be served at https://host.com/\*\*

See [documentation](https://elysiajs.com/plugins/static) for more details.

### bunFullstack

Enable bundling of HTML files (Bun only).
When true, HTML imports using Bun’s bundler, JavaScript transpiler and CSS parser. [See more](https://bun.com/docs/bundler/fullstack)
When false, HTML files are served directly from disk.

### decodeURI
@default false

### detail

specify OpenAPI spec configuration for static routes

### silent
@default false

If set to true, suppresses all logs and warnings from the static plugin