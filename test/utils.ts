let fs = process.getBuiltinModule('fs/promises')

export const req = (path: string) => new Request(`http://localhost${path}`)
const isBun = typeof Bun !== 'undefined' && !!Bun.file
export const takodachi = isBun
    ? await Bun.file('public/takodachi.png').text()
    : await fs.readFile('public/takodachi.png')
