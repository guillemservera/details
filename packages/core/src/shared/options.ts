/** A value, or a getter read whenever the value is needed. A getter may return undefined to use the default. */
export type MaybeGetter<T> = T | (() => T | undefined)

export function read<T>(value: MaybeGetter<T>): T | undefined {
  return typeof value === 'function' ? (value as () => T | undefined)() : value
}
