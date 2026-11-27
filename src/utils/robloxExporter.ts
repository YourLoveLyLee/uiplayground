import type {
  AssetItem,
  PlaygroundProject,
  ScreenArtboard,
  UIElement,
} from '../types/roblox';
import { computeRobloxUDim2 } from './projectLogic';

export interface ExportCompatibilityIssue {
  severity: 'warning' | 'info';
  elementName: string;
  screenName: string;
  message: string;
}

export interface RobloxExportBundle {
  rbxmxXml: string;
  luauRuntime: string;
  rojoProjectJson: string;
  assetManifestJson: string;
  issues: ExportCompatibilityIssue[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hexToRgbTuple(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return { r, g, b };
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return {
      r: Number.isNaN(r) ? 1 : r,
      g: Number.isNaN(g) ? 1 : g,
      b: Number.isNaN(b) ? 1 : b,
    };
  }
  return { r: 0.25, g: 0.25, b: 0.3 };
}

function resolveRobloxClass(el: UIElement): string {
  if (el.type === 'text') {
    return el.interactive.isInteractive ? 'TextButton' : 'TextLabel';
  }
  if (el.type === 'image') {
    return el.interactive.isInteractive ? 'ImageButton' : 'ImageLabel';
  }
  if (el.interactive.isInteractive) {
    return el.appearance.text ? 'TextButton' : 'ImageButton';
  }
  return 'Frame';
}

function sanitizeLuauIdentifier(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(cleaned) ? `UI_${cleaned}` : cleaned || 'Element';
}

function collectCompatibilityIssues(project: PlaygroundProject): ExportCompatibilityIssue[] {
  const issues: ExportCompatibilityIssue[] = [];

  for (const screen of project.screens) {
    for (const el of screen.elements) {
      if (el.type === 'polygon') {
        issues.push({
          severity: 'warning',
          elementName: el.name,
          screenName: screen.name,
          message:
            'Custom vector polygons do not have a native Roblox GuiObject equivalent; exported as a Frame placeholder. Upload as an ImageLabel SVG/PNG for exact silhouette fidelity.',
        });
      }
      if (el.appearance.shadow.enabled) {
        issues.push({
          severity: 'warning',
          elementName: el.name,
          screenName: screen.name,
          message:
            'CSS drop shadows are not natively supported on Roblox GuiObjects; add a 9-slice shadow ImageLabel in Roblox Studio.',
        });
      }
      if (el.appearance.image?.assetId) {
        const asset = project.assets.find((a) => a.id === el.appearance.image?.assetId);
        if (asset && !asset.robloxAssetId) {
          issues.push({
            severity: 'info',
            elementName: el.name,
            screenName: screen.name,
            message: `Local image "${asset.name}" uses a placeholder rbxassetid:// mapping until uploaded to Roblox Creator Hub.`,
          });
        }
      }
      if (el.appearance.extraLayers.length > 0) {
        issues.push({
          severity: 'info',
          elementName: el.name,
          screenName: screen.name,
          message: `${el.appearance.extraLayers.length} extra visual sub-layer(s) exported as child GuiObjects inside "${el.name}".`,
        });
      }
    }
  }

  return issues;
}

function serializeElementToXml(
  el: UIElement,
  screen: ScreenArtboard,
  assets: AssetItem[],
  depth: number
): string {
  const indent = '  '.repeat(depth);
  const parent = el.parentId
    ? screen.elements.find((p) => p.id === el.parentId)
    : undefined;
  const parentW = parent ? parent.width : screen.width;
  const parentH = parent ? parent.height : screen.height;

  const robloxClass = resolveRobloxClass(el);
  const { positionUDim2, sizeUDim2 } = computeRobloxUDim2(el, parentW, parentH);

  // Extract numeric scale/offset from UDim2.new(sx, ox, sy, oy)
  const parseUDim2 = (str: string) => {
    const match = str.match(/UDim2\.new\(([^)]+)\)/);
    const parts = match ? match[1].split(',').map((s) => Number(s.trim())) : [0, 0, 0, 0];
    return { sx: parts[0] || 0, ox: parts[1] || 0, sy: parts[2] || 0, oy: parts[3] || 0 };
  };

  const pos = parseUDim2(positionUDim2);
  const sz = parseUDim2(sizeUDim2);
  const fillRgb = hexToRgbTuple(
    el.appearance.fillColor === 'transparent' ? '#000000' : el.appearance.fillColor
  );
  const bgTransparency =
    el.appearance.fillColor === 'transparent'
      ? 1
      : +(1 - el.appearance.fillOpacity * el.appearance.opacity).toFixed(3);

  const lines: string[] = [];
  lines.push(`${indent}<Item class="${robloxClass}" referent="${escapeXml(el.id)}">`);
  lines.push(`${indent}  <Properties>`);
  lines.push(`${indent}    <string name="Name">${escapeXml(el.name)}</string>`);
  lines.push(`${indent}    <bool name="Visible">${el.visible}</bool>`);
  lines.push(`${indent}    <int name="ZIndex">${el.zIndex}</int>`);
  lines.push(`${indent}    <float name="Rotation">${el.rotation}</float>`);
  lines.push(
    `${indent}    <Vector2 name="AnchorPoint"><X>${el.anchorPoint.x}</X><Y>${el.anchorPoint.y}</Y></Vector2>`
  );
  lines.push(
    `${indent}    <UDim2 name="Position"><XS>${pos.sx}</XS><XO>${pos.ox}</XO><YS>${pos.sy}</YS><YO>${pos.oy}</YO></UDim2>`
  );
  lines.push(
    `${indent}    <UDim2 name="Size"><XS>${sz.sx}</XS><XO>${sz.ox}</XO><YS>${sz.sy}</YS><YO>${sz.oy}</YO></UDim2>`
  );
  lines.push(
    `${indent}    <Color3 name="BackgroundColor3"><R>${fillRgb.r.toFixed(3)}</R><G>${fillRgb.g.toFixed(3)}</G><B>${fillRgb.b.toFixed(3)}</B></Color3>`
  );
  lines.push(`${indent}    <float name="BackgroundTransparency">${bgTransparency}</float>`);
  lines.push(`${indent}    <int name="BorderSizePixel">0</int>`);

  if (el.interactive.isInteractive) {
    lines.push(
      `${indent}    <string name="Attribute_ComponentType">${escapeXml(el.interactive.componentType)}</string>`
    );
  }

  if (el.appearance.text && (robloxClass === 'TextLabel' || robloxClass === 'TextButton')) {
    const tRgb = hexToRgbTuple(el.appearance.text.color);
    lines.push(`${indent}    <string name="Text">${escapeXml(el.appearance.text.content)}</string>`);
    lines.push(`${indent}    <float name="TextSize">${el.appearance.text.fontSize}</float>`);
    lines.push(
      `${indent}    <Color3 name="TextColor3"><R>${tRgb.r.toFixed(3)}</R><G>${tRgb.g.toFixed(3)}</G><B>${tRgb.b.toFixed(3)}</B></Color3>`
    );
  }

  if (el.appearance.image && (robloxClass === 'ImageLabel' || robloxClass === 'ImageButton')) {
    const asset = assets.find((a) => a.id === el.appearance.image?.assetId);
    const assetUri = asset?.robloxAssetId
      ? `rbxassetid://${asset.robloxAssetId}`
      : `rbxassetid://PLACEHOLDER_${sanitizeLuauIdentifier(asset?.name ?? 'IMAGE').toUpperCase()}`;
    lines.push(`${indent}    <Content name="Image"><url>${escapeXml(assetUri)}</url></Content>`);
    if (asset && el.appearance.image.spriteId) {
      const sprite = asset.sprites.find((s) => s.id === el.appearance.image?.spriteId);
      if (sprite) {
        lines.push(
          `${indent}    <Vector2 name="ImageRectOffset"><X>${sprite.x}</X><Y>${sprite.y}</Y></Vector2>`
        );
        lines.push(
          `${indent}    <Vector2 name="ImageRectSize"><X>${sprite.width}</X><Y>${sprite.height}</Y></Vector2>`
        );
      }
    }
  }

  lines.push(`${indent}  </Properties>`);

  if (el.appearance.cornerRadius > 0) {
    const radiusScale = el.appearance.cornerRadius >= 999 ? 1 : 0;
    const radiusOffset = el.appearance.cornerRadius >= 999 ? 0 : el.appearance.cornerRadius;
    lines.push(`${indent}  <Item class="UICorner" referent="${escapeXml(el.id)}_corner">`);
    lines.push(`${indent}    <Properties>`);
    lines.push(
      `${indent}      <UDim name="CornerRadius"><S>${radiusScale}</S><O>${radiusOffset}</O></UDim>`
    );
    lines.push(`${indent}    </Properties>`);
    lines.push(`${indent}  </Item>`);
  }

  if (el.appearance.strokeWidth > 0) {
    const sRgb = hexToRgbTuple(el.appearance.strokeColor);
    lines.push(`${indent}  <Item class="UIStroke" referent="${escapeXml(el.id)}_stroke">`);
    lines.push(`${indent}    <Properties>`);
    lines.push(`${indent}      <float name="Thickness">${el.appearance.strokeWidth}</float>`);
    lines.push(
      `${indent}      <Color3 name="Color"><R>${sRgb.r.toFixed(3)}</R><G>${sRgb.g.toFixed(3)}</G><B>${sRgb.b.toFixed(3)}</B></Color3>`
    );
    lines.push(
      `${indent}      <float name="Transparency">${+(1 - el.appearance.strokeOpacity).toFixed(3)}</float>`
    );
    lines.push(`${indent}    </Properties>`);
    lines.push(`${indent}  </Item>`);
  }

  if (el.appearance.gradient.enabled && el.appearance.gradient.stops.length >= 2) {
    lines.push(`${indent}  <Item class="UIGradient" referent="${escapeXml(el.id)}_grad">`);
    lines.push(`${indent}    <Properties>`);
    lines.push(`${indent}      <float name="Rotation">${el.appearance.gradient.angle}</float>`);
    lines.push(`${indent}    </Properties>`);
    lines.push(`${indent}  </Item>`);
  }

  // Extra visual sub-layers exported as child Frames / TextLabels / ImageLabels
  for (const sub of el.appearance.extraLayers) {
    const subClass =
      sub.kind === 'text' ? 'TextLabel' : sub.kind === 'image' ? 'ImageLabel' : 'Frame';
    lines.push(`${indent}  <Item class="${subClass}" referent="${escapeXml(sub.id)}">`);
    lines.push(`${indent}    <Properties>`);
    lines.push(`${indent}      <string name="Name">${escapeXml(sub.name)}</string>`);
    lines.push(`${indent}      <bool name="Visible">${sub.visible}</bool>`);
    lines.push(
      `${indent}      <UDim2 name="Position"><XS>0</XS><XO>${sub.x}</XO><YS>0</YS><YO>${sub.y}</YO></UDim2>`
    );
    lines.push(
      `${indent}      <UDim2 name="Size"><XS>0</XS><XO>${sub.width}</XO><YS>0</YS><YO>${sub.height}</YO></UDim2>`
    );
    lines.push(`${indent}    </Properties>`);
    lines.push(`${indent}  </Item>`);
  }

  // Recursive children
  const children = screen.elements
    .filter((child) => child.parentId === el.id)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const child of children) {
    lines.push(serializeElementToXml(child, screen, assets, depth + 1));
  }

  lines.push(`${indent}</Item>`);
  return lines.join('\n');
}

function generateLuauRuntime(project: PlaygroundProject): string {
  const lines: string[] = [
    '-- Generated by Roblox UI Playground',
    '-- Place inside StarterGui or ReplicatedStorage and require from a LocalScript',
    'local TweenService = game:GetService("TweenService")',
    'local Players = game:GetService("Players")',
    '',
    'local UIPlaygroundRuntime = {}',
    '',
    'local function tweenProperties(instance, durationSec, props)',
    '\tlocal info = TweenInfo.new(durationSec, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)',
    '\tTweenService:Create(instance, info, props):Play()',
    'end',
    '',
    'function UIPlaygroundRuntime.Mount(playerGui)',
  ];

  for (const screen of project.screens) {
    const screenVar = sanitizeLuauIdentifier(screen.name);
    lines.push(`\t-- ScreenGui: ${screen.name}`);
    lines.push(`\tlocal ${screenVar} = playerGui:WaitForChild("${screen.name}")`);

    const interactiveEls = screen.elements.filter((e) => e.interactive.isInteractive);
    for (const el of interactiveEls) {
      const elVar = `${screenVar}_${sanitizeLuauIdentifier(el.name)}`;
      lines.push(`\tlocal ${elVar} = ${screenVar}:FindFirstChild("${el.name}", true)`);
      lines.push(`\tif ${elVar} then`);

      const idleState = el.interactive.states.idle;
      const hoverState = el.interactive.states.hover;
      const pressedState = el.interactive.states.pressed;

      if (hoverState && idleState) {
        const hoverColor = hexToRgbTuple(hoverState.appearance.fillColor);
        const idleColor = hexToRgbTuple(idleState.appearance.fillColor);
        const dur = (hoverState.transition.durationMs / 1000).toFixed(2);
        lines.push(`\t\t${elVar}.MouseEnter:Connect(function()`);
        lines.push(
          `\t\t\ttweenProperties(${elVar}, ${dur}, { BackgroundColor3 = Color3.new(${hoverColor.r.toFixed(3)}, ${hoverColor.g.toFixed(3)}, ${hoverColor.b.toFixed(3)}) })`
        );
        lines.push(`\t\tend)`);
        lines.push(`\t\t${elVar}.MouseLeave:Connect(function()`);
        lines.push(
          `\t\t\ttweenProperties(${elVar}, ${dur}, { BackgroundColor3 = Color3.new(${idleColor.r.toFixed(3)}, ${idleColor.g.toFixed(3)}, ${idleColor.b.toFixed(3)}) })`
        );
        lines.push(`\t\tend)`);
      }

      if (pressedState) {
        const pressColor = hexToRgbTuple(pressedState.appearance.fillColor);
        const dur = (pressedState.transition.durationMs / 1000).toFixed(2);
        lines.push(`\t\tif ${elVar}:IsA("GuiButton") then`);
        lines.push(`\t\t\t${elVar}.MouseButton1Down:Connect(function()`);
        lines.push(
          `\t\t\t\ttweenProperties(${elVar}, ${dur}, { BackgroundColor3 = Color3.new(${pressColor.r.toFixed(3)}, ${pressColor.g.toFixed(3)}, ${pressColor.b.toFixed(3)}) })`
        );
        lines.push(`\t\t\tend)`);
        lines.push(`\t\tend`);
      }

      // Wire interaction rules
      const rules = screen.rules.filter((r) => r.sourceElementId === el.id);
      for (const rule of rules) {
        const signal =
          rule.trigger === 'click'
            ? 'MouseButton1Click'
            : rule.trigger === 'hoverEnter'
            ? 'MouseEnter'
            : rule.trigger === 'hoverExit'
            ? 'MouseLeave'
            : rule.trigger === 'press'
            ? 'MouseButton1Down'
            : 'MouseButton1Up';

        lines.push(`\t\tif ${elVar}:IsA("GuiButton") then`);
        lines.push(`\t\t\t${elVar}.${signal}:Connect(function()`);
        for (const action of rule.actions) {
          const targetEl = screen.elements.find((t) => t.id === action.targetElementId);
          const targetName = targetEl?.name ?? 'Target';
          if (action.type === 'show' || action.type === 'hide') {
            lines.push(`\t\t\t\tlocal target = ${screenVar}:FindFirstChild("${targetName}", true)`);
            lines.push(`\t\t\t\tif target then target.Visible = ${action.type === 'show'} end`);
          } else if (action.type === 'changeText') {
            lines.push(`\t\t\t\tlocal target = ${screenVar}:FindFirstChild("${targetName}", true)`);
            lines.push(
              `\t\t\t\tif target and (target:IsA("TextLabel") or target:IsA("TextButton")) then target.Text = ${JSON.stringify(action.value ?? '')} end`
            );
          } else if (action.type === 'navigateScreen' && action.targetScreenId) {
            const destScreen = project.screens.find((s) => s.id === action.targetScreenId);
            if (destScreen) {
              lines.push(`\t\t\t\t${screenVar}.Enabled = false`);
              lines.push(
                `\t\t\t\tlocal nextGui = playerGui:FindFirstChild("${destScreen.name}")`
              );
              lines.push(`\t\t\t\tif nextGui then nextGui.Enabled = true end`);
            }
          } else if (action.type === 'enable' || action.type === 'disable') {
            lines.push(`\t\t\t\tlocal target = ${screenVar}:FindFirstChild("${targetName}", true)`);
            lines.push(
              `\t\t\t\tif target and target:IsA("GuiButton") then target.Active = ${action.type === 'enable'} end`
            );
          }
        }
        lines.push(`\t\t\tend)`);
        lines.push(`\t\tend`);
      }

      lines.push(`\tend`);
    }
  }

  lines.push('end');
  lines.push('');
  lines.push('return UIPlaygroundRuntime');
  return lines.join('\n');
}

export function generateRobloxExport(project: PlaygroundProject): RobloxExportBundle {
  const xmlLines: string[] = [
    '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
    '  <External>null</External>',
    '  <External>nil</External>',
  ];

  for (const screen of project.screens) {
    xmlLines.push(`  <Item class="ScreenGui" referent="${escapeXml(screen.id)}">`);
    xmlLines.push('    <Properties>');
    xmlLines.push(`      <string name="Name">${escapeXml(screen.name)}</string>`);
    xmlLines.push(`      <bool name="Enabled">${screen.id === project.activeScreenId}</bool>`);
    xmlLines.push('      <bool name="ResetOnSpawn">false</bool>');
    xmlLines.push('      <token name="ZIndexBehavior">1</token>');
    xmlLines.push('    </Properties>');

    const roots = screen.elements
      .filter((e) => !e.parentId)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const root of roots) {
      xmlLines.push(serializeElementToXml(root, screen, project.assets, 2));
    }

    xmlLines.push('  </Item>');
  }

  xmlLines.push('</roblox>');

  const rojoProject = {
    name: sanitizeLuauIdentifier(project.name),
    tree: {
      $className: 'DataModel',
      ReplicatedStorage: {
        $className: 'ReplicatedStorage',
        UIPlaygroundRuntime: {
          $path: 'src/ReplicatedStorage/UIPlaygroundRuntime.luau',
        },
      },
      StarterGui: {
        $className: 'StarterGui',
        $path: 'src/StarterGui',
      },
    },
  };

  const assetManifest = project.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    dimensions: `${asset.width}x${asset.height}`,
    robloxAssetId: asset.robloxAssetId || 'UNASSIGNED_UPLOAD_REQUIRED',
    isAtlas: asset.isAtlas,
    sprites: asset.sprites.map((s) => ({
      name: s.name,
      ImageRectOffset: [s.x, s.y],
      ImageRectSize: [s.width, s.height],
    })),
  }));

  return {
    rbxmxXml: xmlLines.join('\n'),
    luauRuntime: generateLuauRuntime(project),
    rojoProjectJson: JSON.stringify(rojoProject, null, 2),
    assetManifestJson: JSON.stringify(assetManifest, null, 2),
    issues: collectCompatibilityIssues(project),
  };
}
