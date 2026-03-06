export type PartialRequired<T, K extends keyof T> = Partial<T> & Pick<T, K>

// Enforce a type to be a subset of another type,
// useful for creating a subset of a union
// From https://stackoverflow.com/a/53637746
export type Extends<T, U extends T> = U
