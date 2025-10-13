export const req = (path: string) => new Request(`http://localhost${path}`)

export const takodachi = await Bun.file('public/takodachi.png').text()
