// Your own small semver: enough to check the ranges this project uses.

// '1.4.2' -> { major: 1, minor: 4, patch: 2, prerelease: null }
// '2.0.0-rc.1' -> { major: 2, minor: 0, patch: 0, prerelease: 'rc.1' }
// Anything else throws a TypeError.
export function parseVersion(version) {
  throw new Error('parseVersion is not written yet');
}

// Does `version` satisfy `range`? Supported ranges: '*', exact ('1.2.3', '=1.2.3', '2.0.0-rc.1'), '^1.2.3' and
// '~1.2.3'. Any other range throws a RangeError.
export function satisfies(version, range) {
  throw new Error('satisfies is not written yet');
}
