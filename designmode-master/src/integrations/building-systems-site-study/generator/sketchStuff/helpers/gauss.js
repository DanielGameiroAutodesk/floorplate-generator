// REF: https://gist.github.com/agrafix/56592043c43c8801f40ab7667b9e7f0e
function gauss(sigma, x) {
  const expVal = -1 * Math.pow((0.5 * x) / sigma, 2)
  return Math.exp(expVal)
}

function normalizeArrayL1Norm(array) {
  const sum = array.reduce((a, b) => a + b, 0)
  for (let i = 0; i < array.length; i++) {
    array[i] /= sum
  }
  return array
}

export function normalizeArrayMaxNorm(array, zeroThreshold = 0.01) {
  const maxOfArray = Math.max(...array)
  if (maxOfArray <= zeroThreshold) {
    return array
  }
  for (let i = 0; i < array.length; i++) {
    array[i] /= maxOfArray
  }
  return array
}

function gaussKernel(sigma, signalLength) {
  const v = []
  let n = Math.ceil(sigma * 10)
  if (n > signalLength) {
    n = signalLength
  }
  if (n % 2 === 0) {
    n--
  }

  const offset = Math.floor(n / 2)

  for (let i = 0; i < n; i++) {
    v.push(gauss(sigma, i - offset))
  }

  return normalizeArrayL1Norm(v)
}

export function gaussSmoothen(values, sigma) {
  const out = []
  const n = values.length
  const kernel = gaussKernel(sigma, n)
  const m = kernel.length
  for (let i = 0; i < n; i++) {
    let temp = 0
    for (let j = 0; j < m; j++) {
      let values_index = (i - Math.floor(m / 2) + j + n) % n
      temp += values[values_index] * kernel[j]
    }
    out.push(temp)
  }
  return out
}
