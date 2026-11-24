import { LRUCache } from '../src/utils'

import { expect, it, describe } from 'vitest'

describe('LRUCache', () => {
    it('does not keep the event loop alive after caching an entry', () => {
        const cache = new LRUCache<string, string>()
        cache.set('file', 'content')

        const interval = (
            cache as unknown as { interval?: { hasRef(): boolean } }
        ).interval

        expect(interval).toBeDefined()
        expect(interval?.hasRef()).toBe(false)
    })
})
