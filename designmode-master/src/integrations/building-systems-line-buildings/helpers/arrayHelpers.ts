function sumList(values: number[]) {
  return values.reduce((sum, value) => {
    return sum + value
  }, 0)
}

export function Float32Concat(listOfArrays: Float32Array[]) {
  const lengths = listOfArrays.map((array) => array.length)
  const sumLength = sumList(lengths)
  const result = new Float32Array(sumLength)

  let shift = 0
  for (let i = 0; i < listOfArrays.length; i++) {
    const array = listOfArrays[i]
    result.set(array, shift)
    shift += lengths[i]
  }
  return result
}

export function Uint8Concat(listOfArrays: Uint8Array[]) {
  const lengths = listOfArrays.map((array) => array.length)
  const sumLength = sumList(lengths)
  const result = new Uint8Array(sumLength)

  let shift = 0
  for (let i = 0; i < listOfArrays.length; i++) {
    const array = listOfArrays[i]
    result.set(array, shift)
    shift += lengths[i]
  }
  return result
}
