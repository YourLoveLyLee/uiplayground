import type { PlaygroundProject } from '../types/roblox';
import {
  createElement,
  createStateOverrideFromAppearance,
  enableInteractiveComponent,
} from '../utils/projectLogic';

export function createStarterProject(): PlaygroundProject {
  // Neutral, clean starter screen demonstrating Draw First + Interactive States + Event Wiring
  const panel = createElement('frame', {
    id: 'el_hud_panel',
    name: 'ActionPanel',
    x: 420,
    y: 210,
    width: 440,
    height: 300,
    zIndex: 1,
    anchorPoint: { x: 0, y: 0 },
  });
  panel.appearance.fillColor = '#1E222B';
  panel.appearance.fillOpacity = 0.96;
  panel.appearance.strokeColor = '#333A48';
  panel.appearance.strokeWidth = 1;
  panel.appearance.cornerRadius = 12;

  const titleLabel = createElement('text', {
    id: 'el_title_label',
    name: 'StatusLabel',
    parentId: 'el_hud_panel',
    x: 24,
    y: 24,
    width: 392,
    height: 40,
    zIndex: 2,
  });
  titleLabel.appearance.text = {
    content: 'Ready to Deploy',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 22,
    fontWeight: 700,
    color: '#F4F4F5',
    align: 'left',
    verticalAlign: 'middle',
  };

  const badgeBox = createElement('rectangle', {
    id: 'el_status_banner',
    name: 'BannerCard',
    parentId: 'el_hud_panel',
    x: 24,
    y: 80,
    width: 392,
    height: 68,
    zIndex: 3,
  });
  badgeBox.appearance.fillColor = '#272D3A';
  badgeBox.appearance.strokeColor = '#3F4756';
  badgeBox.appearance.strokeWidth = 1;
  badgeBox.appearance.cornerRadius = 8;
  badgeBox.appearance.text = {
    content: 'Volume: 65%',
    fontFamily: 'JetBrains Mono',
    fontSize: 15,
    fontWeight: 500,
    color: '#D4D4D8',
    align: 'center',
    verticalAlign: 'middle',
  };

  let primaryBtn = createElement('rectangle', {
    id: 'el_primary_btn',
    name: 'ConfirmButton',
    parentId: 'el_hud_panel',
    x: 24,
    y: 220,
    width: 188,
    height: 52,
    zIndex: 4,
  });
  primaryBtn.appearance.fillColor = '#2563EB';
  primaryBtn.appearance.cornerRadius = 8;
  primaryBtn.appearance.text = {
    content: 'Confirm Action',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    align: 'center',
    verticalAlign: 'middle',
  };
  primaryBtn = enableInteractiveComponent(primaryBtn, 'button');

  const hoverState = createStateOverrideFromAppearance(primaryBtn.appearance, 120);
  hoverState.appearance.fillColor = '#3B82F6';
  hoverState.transformDelta.dy = -2;

  const pressedState = createStateOverrideFromAppearance(primaryBtn.appearance, 80);
  pressedState.appearance.fillColor = '#1D4ED8';
  pressedState.transformDelta.dy = 2;

  const disabledState = createStateOverrideFromAppearance(primaryBtn.appearance, 120);
  disabledState.appearance.fillColor = '#3F3F46';
  disabledState.appearance.opacity = 0.6;

  primaryBtn.interactive.states = {
    idle: createStateOverrideFromAppearance(primaryBtn.appearance, 120),
    hover: hoverState,
    pressed: pressedState,
    disabled: disabledState,
  };

  let volumeSlider = createElement('rectangle', {
    id: 'el_volume_slider',
    name: 'VolumeSlider',
    parentId: 'el_hud_panel',
    x: 24,
    y: 168,
    width: 392,
    height: 32,
    zIndex: 5,
  });
  volumeSlider.appearance.fillColor = '#272D3A';
  volumeSlider.appearance.cornerRadius = 9999;
  volumeSlider.appearance.strokeColor = '#3F4756';
  volumeSlider.appearance.strokeWidth = 1;
  volumeSlider = enableInteractiveComponent(volumeSlider, 'slider');
  volumeSlider.interactive.behavior = {
    ...volumeSlider.interactive.behavior,
    min: 0,
    max: 100,
    value: 65,
    step: 1,
    orientation: 'horizontal',
  };

  let navBtn = createElement('rectangle', {
    id: 'el_open_shop_btn',
    name: 'OpenSettingsButton',
    parentId: 'el_hud_panel',
    x: 228,
    y: 220,
    width: 188,
    height: 52,
    zIndex: 6,
  });
  navBtn.appearance.fillColor = '#2D3340';
  navBtn.appearance.strokeColor = '#475569';
  navBtn.appearance.strokeWidth = 1;
  navBtn.appearance.cornerRadius = 8;
  navBtn.appearance.text = {
    content: 'Open Screen 2',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    fontWeight: 600,
    color: '#E4E4E7',
    align: 'center',
    verticalAlign: 'middle',
  };
  navBtn = enableInteractiveComponent(navBtn, 'button');
  const navHover = createStateOverrideFromAppearance(navBtn.appearance, 120);
  navHover.appearance.fillColor = '#374151';
  navBtn.interactive.states.hover = navHover;

  // Second screen for Screen Navigation testing
  const settingsPanel = createElement('frame', {
    id: 'el_settings_panel',
    name: 'SecondaryFrame',
    x: 460,
    y: 220,
    width: 360,
    height: 240,
    zIndex: 1,
  });
  settingsPanel.appearance.fillColor = '#1E222B';
  settingsPanel.appearance.strokeColor = '#333A48';
  settingsPanel.appearance.strokeWidth = 1;
  settingsPanel.appearance.cornerRadius = 12;

  const settingsTitle = createElement('text', {
    id: 'el_settings_title',
    name: 'SecondaryTitle',
    parentId: 'el_settings_panel',
    x: 24,
    y: 24,
    width: 312,
    height: 40,
    zIndex: 2,
  });
  settingsTitle.appearance.text = {
    content: 'Secondary ScreenGui',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 20,
    fontWeight: 700,
    color: '#F4F4F5',
    align: 'center',
    verticalAlign: 'middle',
  };

  let backBtn = createElement('rectangle', {
    id: 'el_back_btn',
    name: 'BackButton',
    parentId: 'el_settings_panel',
    x: 80,
    y: 140,
    width: 200,
    height: 48,
    zIndex: 3,
  });
  backBtn.appearance.fillColor = '#2563EB';
  backBtn.appearance.cornerRadius = 8;
  backBtn.appearance.text = {
    content: 'Return to MainHUD',
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
    align: 'center',
    verticalAlign: 'middle',
  };
  backBtn = enableInteractiveComponent(backBtn, 'button');

  return {
    id: 'proj_starter',
    name: 'Starter Workspace',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    activeScreenId: 'screen_main',
    screens: [
      {
        id: 'screen_main',
        name: 'MainHUD',
        width: 1280,
        height: 720,
        backgroundColor: '#13151B',
        elements: [panel, titleLabel, badgeBox, primaryBtn, volumeSlider, navBtn],
        rules: [
          {
            id: 'rule_confirm_click',
            sourceElementId: 'el_primary_btn',
            trigger: 'click',
            actions: [
              {
                id: 'act_change_title',
                type: 'changeText',
                targetElementId: 'el_title_label',
                value: 'Action Confirmed!',
              },
              {
                id: 'act_play_sound',
                type: 'playSound',
                value: 'click',
              },
            ],
          },
          {
            id: 'rule_slider_change',
            sourceElementId: 'el_volume_slider',
            trigger: 'valueChanged',
            actions: [
              {
                id: 'act_update_banner',
                type: 'changeText',
                targetElementId: 'el_status_banner',
                value: 'Volume: {value}%',
              },
            ],
          },
          {
            id: 'rule_nav_screen2',
            sourceElementId: 'el_open_shop_btn',
            trigger: 'click',
            actions: [
              {
                id: 'act_go_screen2',
                type: 'navigateScreen',
                targetScreenId: 'screen_secondary',
              },
            ],
          },
        ],
      },
      {
        id: 'screen_secondary',
        name: 'SecondaryMenu',
        width: 1280,
        height: 720,
        backgroundColor: '#13151B',
        elements: [settingsPanel, settingsTitle, backBtn],
        rules: [
          {
            id: 'rule_back_main',
            sourceElementId: 'el_back_btn',
            trigger: 'click',
            actions: [
              {
                id: 'act_go_main',
                type: 'navigateScreen',
                targetScreenId: 'screen_main',
              },
            ],
          },
        ],
      },
    ],
    assets: [],
    library: [
      {
        id: 'lib_neutral_btn',
        name: 'Standard Action Button',
        description: 'Interactive button with Idle, Hover, and Pressed visual states.',
        category: 'button',
        rootElement: { ...primaryBtn, parentId: null, x: 100, y: 100 },
        childElements: [],
        rules: [],
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
