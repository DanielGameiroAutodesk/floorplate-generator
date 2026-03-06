import pLimit from "p-limit"
import { v4 } from "uuid"

// Limit the number of concurrent requests to avoid
// browser limits when fetching huge element trees.
//
// Note that the current use of this is not exact,
// since it doesn't encapsulate the response streaming
// as well.
export const requestLimiter = pLimit(100)

export class FetchError extends Error {
  url: string
  responseCode?: number
  responseHeaders?: Record<string, string>
  body?: string
  requestId?: string
  constructor(
    message: string,
    url: string,
    responseCode = 0,
    responseHeaders?: Headers,
    body?: string,
    requestId?: string,
  ) {
    super(message)
    this.url = url
    this.responseCode = responseCode
    this.body = body
    const headers: Record<string, string> = {}
    responseHeaders?.forEach((key, value) => {
      headers[key] = value
    })
    this.responseHeaders = headers
    this.requestId = requestId
  }
}

export async function request(url: string, init?: RequestInit) {
  const canonicalUrl = new URL("https://example.com" + url).pathname
  let res: Response
  try {
    res = await requestLimiter(async () => fetch(url, init))
  } catch (e) {
    if (e instanceof DOMException)
      throw new FetchError(`Request aborted: ${init?.method || "GET"} ${canonicalUrl}`, url)
    else throw new FetchError(`Network error: ${init?.method || "GET"} ${canonicalUrl}`, url)
  }
  if (res.ok) return res
  let body = ""
  try {
    body = await res.text()
  } catch {
    /* empty */
  }
  throw new FetchError(
    `Request failed: ${init?.method || "GET"} ${canonicalUrl} returned ${res.status}`,
    url,
    res.status,
    res.headers,
    body,
  )
}

export function requestApiGateway(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const requestId = headers.get("x-amzn-requestid") || v4()
  headers.set("x-amzn-requestid", requestId)
  if (init) init.headers = headers
  return request(url, init).catch((fetchError: FetchError) => {
    fetchError.requestId = requestId
    throw fetchError
  })
}
