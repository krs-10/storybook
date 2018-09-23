import React from 'react';

import Svg from './util/svg';

const ChevronRight = props => (
  <Svg
    {...props}
    fill="currentColor"
    preserveAspectRatio="xMidYMid meet"
    height="10"
    width="10"
    viewBox="0 0 40 40"
    style={{ verticalAlign: 'top' }}
  >
    <path
      fill="currentColor"
      d="m23.3 20l-13.1-13.6c-0.3-0.3-0.3-0.9 0-1.2l2.4-2.4c0.3-0.3 0.9-0.4 1.2-0.1l16 16.7c0.1 0.1 0.2 0.4 0.2 0.6s-0.1 0.5-0.2 0.6l-16 16.7c-0.3 0.3-0.9 0.3-1.2 0l-2.4-2.5c-0.3-0.3-0.3-0.9 0-1.2z"
    />
  </Svg>
);

export { ChevronRight as default };
