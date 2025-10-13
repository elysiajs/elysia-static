export interface StaticOptions<Prefix extends string> {
    /**
     * @default "public"
     *
     * Asset path to expose as public path
     */
    assets?: string
    /**
     * @default '/public'
     *
     * Path prefix to create virtual mount path for the static directory
     */
    prefix?: Prefix
    /**
     * @default 1024
     *
     * If total files exceed this number,
     * file will be handled via wildcard instead of static route
     * to reduce memory usage
     */
    staticLimit?: number
    /**
     * @default false unless `NODE_ENV` is 'production'
     *
     * Should file always be served statically
     */
    alwaysStatic?: boolean
    /**
     * @default [] `Array<string | RegExp>`
     *
     * Array of file to ignore publication.
     * If one of the patters is matched,
     * file will not be exposed.
     */
    ignorePatterns?: Array<string | RegExp>

    /**
     * Indicate if file extension is required
     *
     * Only works if `alwaysStatic` is set to true
     *
     * @default true
     */
    extension?: boolean

    /**
     *
     * When url needs to be decoded
     *
     * Only works if `alwaysStatic` is set to false
     */
    /**
     * Set headers
     */
    headers?: Record<string, string> | undefined

    /**
     * @default true
     *
     * If set to false, browser caching will be disabled
     *
     * On Bun, if set to false, performance will be significantly improved
     * as it can be inline as a static resource
     */
    etag?: boolean

    /**
     * @default public
     *
     * directive for Cache-Control header
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#directives
     */
    directive?:
        | 'public'
        | 'private'
        | 'must-revalidate'
        | 'no-cache'
        | 'no-store'
        | 'no-transform'
        | 'proxy-revalidate'
        | 'immutable'

    /**
     * @default 86400
     *
     * Specifies the maximum amount of time in seconds, a resource will be considered fresh.
     * This freshness lifetime is calculated relative to the time of the request.
     * This setting helps control browser caching behavior.
     * A `maxAge` of 0 will prevent caching, requiring requests to validate with the server before use.
     */
    maxAge?: number | null

    /**
     *
     */
    /**
     * @default true
     *
     * Enable serving of index.html as default / route
     */
    indexHTML?: boolean

    /**
     * decodeURI
     *
     * @default false
     */
     decodeURI?: boolean

     /**
      * silent
      *
      * @default false
	  *
	  * If set to true, suppresses all logs and warnings from the static plugin
      */
      silent?: boolean
}
