export async function computeSha1Hex(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let arrayBuffer: ArrayBuffer
  if (data instanceof Blob) {
    arrayBuffer = await data.arrayBuffer()
  } else if (data instanceof Uint8Array) {
    // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
    const copy = new Uint8Array(data.length)
    copy.set(data)
    arrayBuffer = copy.buffer
  } else {
    arrayBuffer = data
  }

  const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const sha1Hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return sha1Hex
}
