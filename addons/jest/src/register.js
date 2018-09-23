import React from 'react';
import addons from '@storybook/addons';
import { ADDON_ID, PANEL_ID } from './shared';

// import PanelTitle from './components/PanelTitle';
import Panel from './components/Panel';

addons.register(ADDON_ID, api => {
  const channel = addons.getChannel();

  addons.addPanel(PANEL_ID, {
    title: 'tests',
    // title: () => <PanelTitle channel={channel} api={api} />,
    // eslint-disable-next-line react/prop-types
    render: ({ active }) => <Panel channel={channel} api={api} active={active} />,
  });
});
