import KingWorld from 'kingworld'

import staticPlugin from '../src/index'

const app = new KingWorld()
    .use(staticPlugin, {
        ignorePatterns: ['public/takodachi.png']
    })
    .listen(8080)
