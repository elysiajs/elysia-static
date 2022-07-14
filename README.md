# @kingworldjs/static
Plugin for [kingworld](https://github.com/saltyaom/kingworld) for serving static folder.

## Installation
```bash
bun add @kingworldjs/static
```

## Example
```typescript
import KingWorld from 'kingworld'
import staicFolder from '@kingworldjs/static'

const app = new KingWorld()
    .use(staicFolder)
    .listen(8080)
```

## Config
Below is an available config for static plugin.

### path
@default "public"

Path to expose as public path

### prefix
@default '/public'

Path prefix to create virtual mount path for the static directory

### staticLimit
@defualt 1024

If total files exceed this number, file will be handled via wildcard instead of static route to reduce memory usage

### alwaysStatic
@default boolean

If set to true, file will always use static path instead
