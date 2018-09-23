import React, { PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import produce from 'immer';
import memoize from 'memoizerific';

import { document } from 'global';

import {
  createId,
  prevent,
  isMacLike,
  keyEventToAction,
  getParent,
  getPrevious,
  getSelected,
  getNext,
  toFiltered,
} from './utils';

import {
  Container,
  TreeWrapper,
  ListWrapper,
  Link,
  DefaultLeaf,
  DefaultHead,
  DefaultRootTitle,
  Filter as FilterField,
} from './components';

const linked = (C, { events, prefix = '', Link: L }) => {
  const Linked = p => (
    <L
      href={`#!${p.id}`}
      id={`${prefix}_${p.path}`}
      {...Object.entries(events).reduce(
        (acc, [k, v]) => ({
          ...acc,
          [k]: (...args) => v(...args, p),
        }),
        {}
      )}
    >
      <C {...p} />
    </L>
  );
  Linked.displayName = `Linked${C.displayName}`;

  return Linked;
};

const branchOrLeaf = ({ Branch, Leaf, Head }, { root, dataset }) => {
  const node = dataset[root];
  return node.children ? (
    <Branch key={node.id} {...{ Branch, Leaf, Head, dataset, root }} />
  ) : (
    <Leaf key={node.id} {...node} />
  );
};

const Tree = ({ prefix, root, dataset, Branch = Tree, LeafNode, HeadNode, ...rest }) => {
  const { children, ...node } = dataset[root] || {};
  const events = rest.events || {};
  const Leaf = rest.Leaf || linked(LeafNode || DefaultLeaf, { events, prefix, Link });
  const Head = rest.Head || linked(HeadNode || DefaultHead, { events, prefix, Link });

  const mapNode = i => branchOrLeaf({ Branch, Leaf, Head }, { dataset, root: i });

  switch (true) {
    case !!(children && node.name): {
      return (
        <TreeWrapper>
          <Head {...node} />
          {children && node.isExpanded ? <ListWrapper>{children.map(mapNode)}</ListWrapper> : null}
        </TreeWrapper>
      );
    }
    case !!(children && children.length): {
      return <ListWrapper>{children.map(mapNode)}</ListWrapper>;
    }
    default: {
      return null;
    }
  }
};

const getDataSet = memoize(50)((input, filter) => {
  const full = input;
  const dataset = filter ? toFiltered(full, filter) : full;

  return { input, dataset, full };
});

class TreeState extends PureComponent {
  events = {
    onClick: (e, item) => {
      const { allowMultiple, allowNonLeaf, allowClick } = this.props;
      const { dataset } = this.state;
      const isLeaf = !dataset[item.path].children;

      if (!((allowNonLeaf || isLeaf) && allowClick) || !(!allowNonLeaf && allowClick)) {
        prevent(e);
      }

      const selected = getSelected({ dataset });
      const add = allowMultiple && isMacLike() ? e.metaKey : e.ctrlKey;

      const replacement = produce(dataset, set => {
        if (!(!allowNonLeaf && dataset[item.path].children)) {
          // eslint-disable-next-line no-param-reassign
          set[item.path].isSelected = true;
        }

        if (set[item.path].children) {
          // eslint-disable-next-line no-param-reassign
          set[item.path].isExpanded = set[item.path].isSelected || !set[item.path].isExpanded;
        }

        if (!add) {
          selected.forEach(i => {
            // eslint-disable-next-line no-param-reassign
            set[i.path].isSelected = false;
          });
        }
      });

      this.setState({
        dataset: replacement,
      });
    },
    onKeyUp: (e, item) => {
      const { dataset } = this.state;
      const { prefix } = this.props;

      const action = keyEventToAction(e);
      if (action) {
        prevent(e);
      }
      if (action === 'RIGHT') {
        if (!dataset[item.path].children || dataset[item.path].isExpanded) {
          const next = getNext({ path: item.path, dataset });
          if (next) {
            document.getElementById(createId(next.path, prefix)).focus();
          }
        }
        const replacement = produce(dataset, set => {
          // eslint-disable-next-line no-param-reassign
          set[item.path].isExpanded = true;
        });

        this.setState({
          dataset: replacement,
        });
      }
      if (action === 'LEFT') {
        if (!dataset[item.path].children || !dataset[item.path].isExpanded) {
          const parent = getParent({ path: item.path, dataset });
          if (parent && parent.children) {
            document.getElementById(createId(parent.path, prefix)).focus();
          } else {
            const prev = getPrevious({ path: item.path, dataset });
            if (prev) {
              document.getElementById(createId(prev.path, prefix)).focus();
            }
          }
        }
        const replacement = produce(dataset, set => {
          // eslint-disable-next-line no-param-reassign
          set[item.path].isExpanded = false;
        });

        this.setState({
          dataset: replacement,
        });
      }
      if (action === 'DOWN') {
        const next = getNext({ path: item.path, dataset });
        if (next) {
          document.getElementById(createId(next.path, prefix)).focus();
        }
      }
      if (action === 'UP') {
        const prev = getPrevious({ path: item.path, dataset });
        if (prev) {
          document.getElementById(createId(prev.path, prefix)).focus();
        }
      }
    },
    onFilter: e => {
      const input = e.target.value;
      const { full } = this.state;
      if (input.length >= 2) {
        const dataset = toFiltered(full, input);
        this.setState({
          dataset,
        });
      } else {
        this.setState({
          dataset: full,
        });
      }
    },
  };

  constructor(props, ...rest) {
    super(props, ...rest);

    const { LeafNode, HeadNode, prefix, ...other } = props;
    this.state = getDataSet(props.dataset);

    this.Filter = other.Filter || FilterField;
    this.Link = other.Link || Link;
    this.Branch = other.Branch || Tree;
    this.RootTitle = other.RootTitle || DefaultRootTitle;
    this.Leaf =
      other.Leaf ||
      linked(LeafNode || DefaultLeaf, {
        events: { onClick: this.events.onClick, onKeyUp: this.events.onKeyUp },
        prefix,
        Link: this.Link,
      });
    this.Head =
      other.Head ||
      linked(HeadNode || DefaultHead, {
        events: { onClick: this.events.onClick, onKeyUp: this.events.onKeyUp },
        prefix,
        Link: this.Link,
      });
  }

  static getDerivedStateFromProps(props, state) {
    const fromProp = getDataSet(props.dataset).input;
    const fromState = state.input;

    if (fromProp === fromState) {
      return state;
    }
    return { ...state, ...getDataSet(props.dataset) };
  }

  render() {
    const { Head, Leaf, Branch, Filter, RootTitle, events } = this;
    const { dataset } = this.state;

    const roots = Object.values(dataset).filter(i => i.isRoot);

    return (
      <Fragment>
        {Filter ? <Filter onChange={this.events.onFilter} /> : null}
        {roots.map(({ id, name, children }) => (
          <Fragment key={id}>
            <RootTitle type="section" mods={['uppercase']}>
              {name}
            </RootTitle>
            <Container>
              {children.map(key => (
                <Branch
                  dataset={dataset}
                  root={key}
                  events={events}
                  Head={Head}
                  Leaf={Leaf}
                  Branch={Branch}
                />
              ))}
            </Container>
          </Fragment>
        ))}
      </Fragment>
    );
  }
}
TreeState.propTypes = {
  prefix: PropTypes.string.isRequired,
  allowMultiple: PropTypes.bool,
  allowNonLeaf: PropTypes.bool,
  allowClick: PropTypes.bool,
  dataset: PropTypes.shape({}).isRequired,
  LeafNode: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ render: PropTypes.func.isRequired }),
  ]),
  HeadNode: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ render: PropTypes.func.isRequired }),
  ]),
  Filter: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ render: PropTypes.func.isRequired }),
  ]),
  Link: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ render: PropTypes.func.isRequired }),
  ]),
  Branch: PropTypes.func,
  Leaf: PropTypes.func,
  Head: PropTypes.func,
  RootTitle: PropTypes.func,
};
TreeState.defaultProps = {
  allowMultiple: false,
  allowNonLeaf: false,
  allowClick: false,
  LeafNode: undefined,
  HeadNode: undefined,
  Filter: undefined,
  Link: undefined,
  Branch: undefined,
  Leaf: undefined,
  Head: undefined,
  RootTitle: undefined,
};

export { TreeState, Tree, DefaultLeaf as Leaf, DefaultHead as Head, Container };
