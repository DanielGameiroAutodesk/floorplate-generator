import type { Urn } from "@spacemakerai/element-types"

let cache: Cache

function handleError(reason: any) {
  console.warn(reason)
}

caches
  .open("wsm-cache")
  .then((res) => (cache = res))
  .then(() => {
    return cache.keys()
  })
  .then((responses) => {
    //check everything in cache on load, and clean anything older than 30 days.
    responses.forEach((response) => {
      const insertTime = Number(response.headers.get("timeOfLastReadOrWrite") as string)
      const expirationTime = new Date().setDate(new Date().getDate() - 30)

      if (insertTime < expirationTime) {
        void cache.delete(response)
      }
    })
  })
  .catch(handleError)

function getCacheKey(urn: string) {
  return urn.replace(":", "/")
}

export async function readFromWSMCache(urn: string) {
  if (!cache) return ""
  return cache
    .match(new Request(getCacheKey(urn)))
    .then((response) => (response ? response.text() : ""))
    .then((data) => {
      //After reading, we want to renew timeOfLastReadOrWrite in headers
      //This way the things the user is accessing are fresh in cache.
      if (data) {
        void writeToWSMCache(urn, data)
      }
      return data
    })
    .catch((err) => {
      handleError(err)
      return ""
    })
}

export async function writeToWSMCache(urn: string, val: string) {
  const headers = { headers: { timeOfLastReadOrWrite: Date.now().toString() } }

  return (
    cache
      //Why putting headers in both request and response?
      //Well it seems that .matchAll() can only access response headers, and .keys()
      //can only access request headers. So just keeping this flexible for the future.
      .put(new Request(getCacheKey(urn), headers), new Response(val, headers))
      .catch(handleError)
  )
}

// This function adds the axm representation from the previous urn to the new urn so the updated
// element can find its axm backing rep in the cache.
export async function updateWSMCache(previousUrn: Urn, newUrn: Urn) {
  const cacheVal = await readFromWSMCache(previousUrn)
  if (cacheVal !== "") {
    void writeToWSMCache(newUrn, cacheVal)
    //TODO delete the old urn from cache
  }
}
