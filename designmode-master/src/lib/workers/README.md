# Using typescript workers in Vite

Most of this is taken from [this article](https://vitejs.dev/guide/features.html#web-workers), but with a custom hook
that gives you a promise interface.

## Example worker

To create a worker, create a file like this:

```typescript
type ListOfNumbers = number[]

self.onmessage = (e: MessageEvent<ListOfNumbers>) => {
  const input: ListOfNumbers = e.data
  const max = input.reduce((max, curr) => (curr > max ? curr : max), Number.MIN_VALUE)

  self.postMessage(max)
}

export {}
```

## Using the worker

A vite feature is to import a worker by importing it like this:

```typescript
import MaxWorker from "./exampleWorker?worker"
```

Note the `?worker` suffix that gives you a worker constructor for your worker, enabling you to use it like this:

```typescript
const myWorker: Worker = new MaxWorker()
myWorker.onmessage = (message: MessageEvent<number>) => {
  const max = message.data
  console.log("The result is:", max)
}

myWorker.postMessage([16, 24, 7, 234, 73465, 123, 7, 234, 1234])
```

## A promise interface for workers

In the [useWorker](useWorker.ts) file, you can find a hook to set up a worker that will give you an input/output
promise interface to your worker that can be called repeatedly like an async function.

Usage:

```typescript
import { useInputOutputWorker } from "./useWorker"
import MaxWorker from "./exampleWorker?worker"
import { useEffect } from "preact/compat"

function MyMaxCalculatingReactComponent(props: { arrays: number[][] }) {
  const calculateMax = useInputOutputWorker<number[], number>(Worker)

  useEffect(() => {
    async function calculateAllMaxes() {
      const promises: Promise<number>[] = props.arrays.map(calculateMax)
      promises.forEach((maxPromise) =>
        maxPromise
          .then((max) => console.log("Here's the max:", max))
          .catch((err) => console.log("Something went wrong :(", err)),
      )
    }
  }, [props, calculateMax])
  return null
}
```
