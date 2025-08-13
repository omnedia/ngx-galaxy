# ngx-galaxy

This library is part of the **NGXUI** ecosystem.
View all available components at [https://ngxui.com](https://ngxui.com)

`@omnedia/ngx-galaxy` is an Angular library that renders an interactive animated galaxy background using WebGL. It supports mouse interaction, repulsion effects, twinkling stars, and multiple customization options. You can layer content above the galaxy using `ng-content`.

---

## Features

* Animated multi-layer galaxy starfield.
* Mouse-follow, mouse-repulsion, or auto-center repulsion.
* Adjustable density, speed, hue, glow, and saturation.
* Transparent or opaque backgrounds.
* Works as a standalone Angular component with `ng-content` overlay.

---

## Installation

```bash
npm install @omnedia/ngx-galaxy ogl
```

---

## Usage

Import the `NgxGalaxyComponent` in your Angular component or page:

```typescript
import {NgxGalaxyComponent} from '@omnedia/ngx-galaxy';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgxGalaxyComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent {
}
```

In your template:

```html

<om-galaxy [focal]="[0.5, 0.5]" [mouseInteraction]="true">
  <h1>Welcome to the Galaxy</h1>
</om-galaxy>
```

---

## How It Works

* The galaxy is drawn in a `<canvas>` element using WebGL.
* The `<ng-content>` slot allows you to overlay any HTML/UI elements on top of the galaxy.
* Mouse position is tracked (if enabled) to create parallax or repulsion effects.
* The galaxy parameters are passed via `@Input()` bindings.

---

## API

```html

<om-galaxy
  [focal]="[0.5, 0.5]"
  [rotation]="[1.0, 0.0]"
  [starSpeed]="0.5"
  [density]="1"
  [hueShift]="140"
  [disableAnimation]="false"
  [speed]="1.0"
  [mouseInteraction]="true"
  [glowIntensity]="0.3"
  [saturation]="0.0"
  [mouseRepulsion]="true"
  [twinkleIntensity]="0.3"
  [rotationSpeed]="0.1"
  [repulsionStrength]="2"
  [autoCenterRepulsion]="0"
  [transparent]="true"
  styleClass="custom-class"
>
  <ng-content></ng-content>
</om-galaxy>
```

### Inputs (with defaults)

* `focal` — `[number, number]` focal point in normalized coordinates. **Default:** `[0.5, 0.5]`
* `rotation` — `[number, number]` manual rotation matrix values. **Default:** `[1.0, 0.0]`
* `starSpeed` — Star layer movement speed. **Default:** `0.5`
* `density` — Star density multiplier. **Default:** `1`
* `hueShift` — Global hue rotation in degrees. **Default:** `140`
* `disableAnimation` — Stops animation if `true`. **Default:** `false`
* `speed` — Overall animation speed multiplier. **Default:** `1.0`
* `mouseInteraction` — Enables mouse interaction. **Default:** `true`
* `glowIntensity` — Brightness of star flares. **Default:** `0.3`
* `saturation` — Color saturation multiplier. **Default:** `0.0`
* `mouseRepulsion` — Repels stars from mouse position. **Default:** `true`
* `twinkleIntensity` — Amount of star brightness flicker. **Default:** `0.3`
* `rotationSpeed` — Automatic scene rotation speed. **Default:** `0.1`
* `repulsionStrength` — Strength of mouse repulsion. **Default:** `2`
* `autoCenterRepulsion` — Repulsion from the galaxy center. **Default:** `0`
* `transparent` — Renders background with alpha transparency. **Default:** `true`
* `styleClass` — Custom CSS class for the outer container.

---

## Example

```html

<om-galaxy [hueShift]="200" [density]="1.5" [twinkleIntensity]="0.5">
  <div class="headline">
    <h2>Explore the Stars</h2>
  </div>
</om-galaxy>
```

**SCSS:**

```scss
om-galaxy .headline {
  text-align: center;
  color: white;
  margin-top: 4rem;
}
```

---

## Styling

The default structure:

```html

<div class="om-galaxy">
  <div class="om-galaxy-background"></div>
  <div class="content-inside">
    <ng-content></ng-content>
  </div>
</div>
```

`.om-galaxy-background` has `pointer-events: none` so it never blocks interaction with your content.

---

## Contributing

Contributions are welcome via PR or issue submission.

## License

MIT License
