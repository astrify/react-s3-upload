import { addons } from '@storybook/manager-api';

addons.setConfig({
  // Hide the sidebar (navigation)
  navSize: 0,
  
  // Hide the toolbar
  showToolbar: false,
  
  // Hide panel (addons panel) - set to false to hide completely
  showPanel: false,
  
  // Set panel position to bottom and height to 0 as additional measure
  panelPosition: 'bottom',
  bottomPanelHeight: 0,
  
  // Disable keyboard shortcuts
  enableShortcuts: false,
  
  // Additional layout customizations to ensure everything is hidden
  layoutCustomisations: {
    // Always hide sidebar regardless of view mode
    showSidebar: () => false,
    
    // Always hide toolbar regardless of view mode  
    showToolbar: () => false,
  },
  
  // Hide specific toolbar items if toolbar gets shown
  toolbar: {
    title: { hidden: true },
    zoom: { hidden: true },
    fullscreen: { hidden: true },
    eject: { hidden: true },
    copy: { hidden: true },
    remount: { hidden: true },
  },
  
  // Hide the sidebar roots
  sidebar: {
    showRoots: false,
  },
  
  // Set initial active to canvas (not sidebar or addons)
  initialActive: 'canvas',
});