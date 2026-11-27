import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAlignmentSnap,
  computeRobloxUDim2,
  createElement,
  duplicateComponentState,
  enableInteractiveComponent,
  reorderElementZIndex,
  resolveElementState,
} from './projectLogic';
import { generateRobloxExport } from './robloxExporter';
import { createStarterProject } from '../data/starterProject';

test('draw first, assign functionality later preserves custom appearance in Idle state', () => {
  const square = createElement('square', {
    name: 'CustomBtn',
    x: 100,
    y: 120,
    width: 140,
    height: 48,
  });
  square.appearance.fillColor = '#E11D48';
  square.appearance.cornerRadius = 12;

  assert.equal(square.interactive.isInteractive, false);

  const interactive = enableInteractiveComponent(square, 'button');
  assert.equal(interactive.interactive.isInteractive, true);
  assert.equal(interactive.interactive.componentType, 'button');
  assert.equal(interactive.interactive.states.idle?.appearance.fillColor, '#E11D48');
  assert.equal(interactive.interactive.states.idle?.appearance.cornerRadius, 12);
});

test('duplicating a visual state isolates edits from the original state', () => {
  const el = enableInteractiveComponent(createElement('rectangle', { name: 'PlayBtn' }), 'button');
  const withPressed = duplicateComponentState(el, 'idle', 'pressed');

  // Mutate pressed state independently
  withPressed.interactive.states.pressed!.appearance.fillColor = '#16A34A';
  withPressed.interactive.states.pressed!.transformDelta.dy = 4;

  const idleResolved = resolveElementState(withPressed, 'idle');
  const pressedResolved = resolveElementState(withPressed, 'pressed');

  assert.notEqual(idleResolved.appearance.fillColor, '#16A34A');
  assert.equal(pressedResolved.appearance.fillColor, '#16A34A');
  assert.equal(pressedResolved.y, withPressed.y + 4);
  assert.equal(idleResolved.y, withPressed.y);
});

test('computeRobloxUDim2 calculates anchored scale position and offset size', () => {
  const el = createElement('rectangle', {
    x: 540,
    y: 310,
    width: 200,
    height: 100,
    anchorPoint: { x: 0.5, y: 0.5 },
    useScalePosition: true,
    useScaleSize: false,
  });

  const result = computeRobloxUDim2(el, 1280, 720);
  assert.equal(result.positionUDim2, 'UDim2.new(0.5, 0, 0.5, 0)');
  assert.equal(result.sizeUDim2, 'UDim2.new(0, 200, 0, 100)');
  assert.equal(result.anchorString, 'Vector2.new(0.5, 0.5)');
});

test('computeAlignmentSnap snaps to artboard center and generates guides', () => {
  const snap = computeAlignmentSnap(
    { x: 543, y: 200, width: 200, height: 60 },
    [],
    1280,
    720,
    6
  );

  // Center of 1280 is 640; moving box center is 543+100=643 -> snaps to 640 -> x=540
  assert.equal(snap.x, 540);
  assert.ok(snap.guides.some((g) => g.axis === 'x' && g.position === 640));
});

test('reorderElementZIndex moves elements cleanly', () => {
  const a = createElement('rectangle', { id: 'a', zIndex: 1 });
  const b = createElement('rectangle', { id: 'b', zIndex: 2 });
  const c = createElement('rectangle', { id: 'c', zIndex: 3 });

  const updated = reorderElementZIndex([a, b, c], 'a', 'front');
  const map = new Map(updated.map((e) => [e.id, e.zIndex]));
  assert.equal(map.get('b'), 1);
  assert.equal(map.get('c'), 2);
  assert.equal(map.get('a'), 3);
});

test('generateRobloxExport produces valid ScreenGui XML, Luau script, and Rojo JSON', () => {
  const project = createStarterProject();
  const bundle = generateRobloxExport(project);

  assert.ok(bundle.rbxmxXml.includes('<Item class="ScreenGui"'));
  assert.ok(bundle.rbxmxXml.includes('<Item class="UICorner"'));
  assert.ok(bundle.luauRuntime.includes('UIPlaygroundRuntime.Mount'));
  assert.ok(bundle.rojoProjectJson.includes('"StarterGui"'));
  assert.ok(Array.isArray(bundle.issues));
});
