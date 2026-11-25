// A private helper: the package uses it, but users of the package must not import it.
// Rounds half up: 2.5 -> 3, 2.4 -> 2. Works for the positive amounts this package handles.
export function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}
