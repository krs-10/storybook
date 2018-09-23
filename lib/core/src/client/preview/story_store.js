/* eslint no-underscore-dangle: 0 */
import { window, history } from 'global';
import { EventEmitter } from 'events';
import qs from 'qs';
import mergeWith from 'lodash.mergewith';
import Events from '@storybook/core-events';

// TODO: these are copies from components/nav/lib
// refactor to DRY

const toKey = input =>
  input.replace(/[^a-z0-9]+([a-z0-9])/gi, (...params) => params[1].toUpperCase());

const toGroup = name => ({
  name,
  children: [],
  id: toKey(name),
});
const toChild = it => ({ ...it });

// merge with concatinating arrays, but no duplicates
const merge = (a, b) =>
  mergeWith(a, b, (objValue, srcValue) => {
    if (Array.isArray(objValue)) {
      srcValue.forEach(key => {
        const existing = objValue.find(id => id === key);
        if (!existing) {
          objValue.push(key);
        }
      });
      return objValue;
      // return objValue.concat(srcValue);
    }
    return undefined;
  });

export const splitPath = (path, { rootSeparator, groupSeparator }) => {
  const [root, remainder] = path.split(rootSeparator, 2);
  const groups = (remainder || path).split(groupSeparator);

  // when there's no remainder, it means the root wasn't found/split
  return {
    root: remainder ? root : null,
    groups,
  };
};

export { toKey };

let count = 0;

function getId() {
  count += 1;
  return count;
}

const toExtracted = obj =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    if (typeof value === 'function') {
      return acc;
    }
    if (Array.isArray(value)) {
      return Object.assign(acc, { [key]: value.slice().sort() });
    }
    return Object.assign(acc, { [key]: value });
  }, {});

export default class StoryStore extends EventEmitter {
  constructor() {
    super();

    this._legacydata = {};
    this._data = {};
    this._revision = 0;
    this._selection = {};

    this.on(Events.STORY_INIT, () => {
      this.setSelection(this.fromPath(this.getPath()));
    });
  }

  // NEW apis

  getUrlData(path) {
    const [, p1, p2] = path.match(/\/([^/]+)\/([^/]+)?/) || [];

    const result = {};
    if (p1 && p1.match(/(components|info)/)) {
      Object.assign(result, {
        componentRoot: p1,
        component: p2,
      });
    }
    return result;
  }

  getPath = () => {
    const { path } = qs.parse(window.location.search, { ignoreQueryPrefix: true });
    return path;
  };

  setPath = input => {
    history.replaceState({}, '', `iframe.html?path=${input}`);
  };

  fromPath = path => {
    const { component } = this.getUrlData(path);

    try {
      const data = this._data[component];

      if (!data || !data.decorated) {
        return null;
      }

      return {
        ...data,
        story: p => data.decorated({ ...data, parameters: { ...data.parameters, ...p } }),
      };
    } catch (e) {
      console.log('failed to get story:', this._data);
      console.error(e);
      return {};
    }
  };

  setSeparators(data) {
    this.separators = data;
  }

  extract() {
    // removes function values from all stories so they are safe to transport over the channel
    return Object.entries(this._data).reduce(
      (a, [k, v]) => Object.assign(a, { [k]: toExtracted(v) }),
      {}
    );
  }

  setSelection = data => {
    this._selection = data;
    window.setTimeout(() => this.emit(Events.STORY_RENDER), 1);
  };

  getSelection = () => this._selection;

  addStory({ kind, name, story, decorated, parameters = {} }, { rootSeparator, groupSeparator }) {
    const { _data } = this;
    const { root, groups } = splitPath(kind, { rootSeparator, groupSeparator });
    const rootId = toKey(root);

    const h = []
      .concat(root || [])
      .concat(groups)
      .map(toGroup);

    const id = h
      .map(g => g.id)
      .concat(toKey(name))
      .join('-');

    const child = toChild({
      kind,
      name,
      story,
      decorated,
      parameters,
      id,
    });

    // add groups
    h.reduceRight((childId, group, index, list) => {
      const path = list
        .slice(0, index + 1)
        .map(g => g.id)
        .join('-');

      const existing = _data[path] || {};
      const isRoot = group.id === rootId;
      const isComponent = index === list.length - 1;
      const depth = index;

      _data[path] = merge(
        existing,
        merge(group, { children: [childId], isRoot, isComponent, depth, path })
      );

      return path;
    }, id);

    // add item
    const existing = _data[id] || {};
    _data[id] = merge(existing, { ...child, depth: h.length, path: id });

    // LEGACY DATA
    this.addLegacyStory({ kind, name, story, decorated, parameters });
  }

  // OLD apis
  getRevision() {
    return this._revision;
  }

  incrementRevision() {
    this._revision += 1;
  }

  addLegacyStory({ kind, name, decorated, parameters = {} }) {
    const k = toKey(kind);
    if (!this._legacydata[k]) {
      this._legacydata[k] = {
        kind,
        fileName: parameters.fileName,
        index: getId(),
        stories: {},
      };
    }

    this._legacydata[k].stories[toKey(name)] = {
      name,
      // kind,
      index: getId(),
      fn: decorated,
      parameters,
    };

    // this.emit(Events.STORY_ADDED, kind, name, decorated, parameters);
  }

  getStoryKinds() {
    return Object.values(this._legacydata)
      .filter(kind => Object.keys(kind.stories).length > 0)
      .sort((info1, info2) => info1.index - info2.index)
      .map(info => info.kind);
  }

  getStories(kind) {
    if (!this._legacydata[toKey(kind)]) {
      return [];
    }

    return Object.keys(this._legacydata[toKey(kind)].stories)
      .map(name => this._legacydata[toKey(kind)].stories[name])
      .sort((info1, info2) => info1.index - info2.index)
      .map(info => info.name);
  }

  getStoryFileName(kind) {
    const storiesKind = this._legacydata[toKey(kind)];
    if (!storiesKind) {
      return null;
    }

    return storiesKind.fileName;
  }

  getStoryAndParameters(kind, name) {
    if (!kind || !name) {
      return null;
    }

    const storiesKind = this._legacydata[toKey(kind)];
    if (!storiesKind) {
      return null;
    }

    const storyInfo = storiesKind.stories[toKey(name)];
    if (!storyInfo) {
      return null;
    }

    const { fn, parameters } = storyInfo;
    return {
      story: fn,
      parameters,
    };
  }

  getStory(kind, name) {
    const data = this.getStoryAndParameters(kind, name);
    return data && data.story;
  }

  getStoryWithContext(kind, name) {
    const data = this.getStoryAndParameters(kind, name);
    if (!data) {
      return null;
    }

    const { story, parameters } = data;
    return () =>
      story({
        kind,
        story: name,
        parameters,
      });
  }

  removeStoryKind(kind) {
    if (this.hasStoryKind(kind)) {
      this._legacydata[toKey(kind)].stories = {};
    }
  }

  hasStoryKind(kind) {
    return Boolean(this._legacydata[toKey(kind)]);
  }

  hasStory(kind, name) {
    return Boolean(this.getStory(kind, name));
  }

  dumpStoryBook() {
    const data = this.getStoryKinds().map(kind => ({
      kind,
      stories: this.getStories(kind),
    }));

    return data;
  }

  size() {
    return Object.keys(this._legacydata).length;
  }

  clean() {
    this.getStoryKinds().forEach(kind => delete this._legacydata[toKey(kind)]);
  }
}
