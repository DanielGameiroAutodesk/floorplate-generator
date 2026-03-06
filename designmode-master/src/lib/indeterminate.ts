import { objectKeys } from "./record"

export type WithIndeterminate<T> = { type: "equal"; value: T } | { type: "indeterminate"; values: T[] }

// type A = {a: number, b: string}   =>  {a: WithIndeterminate<number>, b: WithIndeterminate<string>}
export type WithIndeterminateValues<T> = { [Key in keyof T]: WithIndeterminate<T[Key]> }

function getFromValues<T>(values: T[]): WithIndeterminate<T> {
  if (values.length === 0) {
    return { type: "indeterminate", values: [] }
  }
  const first = values[0]
  if (values.every((t) => t === first)) {
    return {
      type: "equal",
      value: first,
    }
  }

  return {
    type: "indeterminate",
    values: values,
  }
}

function getFromObjects<T extends object>(objects: T[]): WithIndeterminateValues<T> {
  const res: Partial<WithIndeterminateValues<T>> = {}
  for (const key of objectKeys(objects[0])) {
    res[key] = getFromValues(objects.map((o) => o[key]))
  }
  return res as WithIndeterminateValues<T>
}

function valueOrDefault<T>(val: WithIndeterminate<T>, def: T): T {
  return val.type === "equal" ? val.value : def
}

function objectOrDefault<T>(object: WithIndeterminateValues<T>, def: T): T {
  type ObjectKey = keyof typeof object
  const res = def
  for (const key of objectKeys(object) as ObjectKey[]) {
    const val = object[key]
    if (val.type === "equal") {
      res[key] = val.value
    }
  }
  return res
}

function makeIndeterminate<T>(value: T): WithIndeterminate<T> {
  return { type: "equal", value }
}

function makeIndeterminateObject<T extends object>(value: T): WithIndeterminateValues<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, makeIndeterminate(val)]),
  ) as WithIndeterminateValues<T>
}

export default {
  getFromValues,
  getFromObjects,
  valueOrDefault,
  objectOrDefault,
  makeIndeterminate,
  makeIndeterminateObject,
}
