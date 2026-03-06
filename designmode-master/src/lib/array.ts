/**
 * Returns an array of arrays of chunk size 2,
 * where each of the contained arrays are sliding windows
 * of the original array
 *
 * @param myArray {Array} Array to split
 *
 * Example:
 * sliding2(["hey", "mr", "tambourine", "man"]) -> [["hey", "mr"], ["mr", "tambourine"], ["tambourine", "man"]]
 */

const ArrayUtils = {
  sliding2: <A>(myArray: A[]): [A, A][] => {
    const chunks: [A, A][] = []

    for (let i = 0; i <= myArray.length - 2; i++) {
      chunks.push(myArray.slice(i, i + 2) as [A, A])
    }

    return chunks
  },
  sliding3: <A>(myArray: A[]): [A, A, A][] => {
    const chunks: [A, A, A][] = []

    for (let i = 0; i <= myArray.length - 3; i++) {
      chunks.push(myArray.slice(i, i + 3) as [A, A, A])
    }

    return chunks
  },
  groupBy: <A, B>(arr: A[], deriveProperty: (elem: A, i: number) => B): Map<B, A[]> => {
    return arr.reduce((acc: Map<B, A[]>, elem: A, i) => {
      const derivedProp = deriveProperty(elem, i)
      acc.set(derivedProp, (acc.get(derivedProp) || []).concat(elem))
      return acc
    }, new Map())
  },
  associateBy: <T, K>(arr: Iterable<T>, keySelector: (elem: T) => K): Map<K, T> => {
    const result = new Map<K, T>()
    for (const item of arr) {
      result.set(keySelector(item), item)
    }
    return result
  },
  sum: (array: number[]): number =>
    array.reduce((a, b) => {
      return a + b
    }, 0),
  unique: <A>(myArray: A[]): A[] => {
    return [...new Set(myArray).values()]
  },
  equal(array1: any[], array2: any[]) {
    if (array1.length !== array2.length) return false
    const set = new Set(array1.concat(array2))
    return set.size === array1.length
  },
  collect: <A, B>(array: A[], collector: (elem: [A, number, A[]]) => B | undefined): B[] => {
    const collected: B[] = []
    array.forEach((elem, i, arr) => {
      const result = collector([elem, i, arr])
      if (result) collected.push(result)
    })
    return collected
  },
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null
}

// WARNING: This is not a drop in replacement solution and
// it might not work for some edge cases. Test your code!
export function minBy<T>(arr: T[], func: (item: T) => number) {
  const min = Math.min(...arr.map(func))
  return arr.find((item) => func(item) === min)
}

export function uniq<T>(arr: T[]) {
  return [...new Set(arr)] as T[]
}

export default ArrayUtils
