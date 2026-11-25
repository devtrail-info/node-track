// New code, an ES module (this repo's package.json has "type": "module").
// TODO: import slugify by name from the new ES module text-utils.js instead.
import textUtils from './text-utils.cjs';

export function pageLinks(titles) {
  return titles.map((title) => `/${textUtils.slugify(title)}`);
}
