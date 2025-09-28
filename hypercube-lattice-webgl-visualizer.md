
### Hypercube Lattice WebGL Visualizer

> **Current Implementation:** The production version of this visualizer now lives inside the HypercubeCore TypeScript modules: `src/core/hypercubeCore.ts`, `src/core/uberShaderBuilder.ts`, and `src/core/rotationUniforms.ts`, with fragment shader assembly handled by `UberShaderBuilder`. The historical notes below describe the earlier prototype hosted in `app.js` and remain for archival context.

*   **Historical File Path:** `/mnt/c/Users/millz/Desktop/hypercubeapp0.2/app.js`
*   **Dependencies:** WebGL
*   **Visual Description:** This is a highly customizable WebGL visualizer that renders a 4D hypercube lattice. It supports various visual parameters that can be dynamically controlled, creating effects like morphing, RGB glitching, rotation, and density changes. The visualizer's color scheme and overall "feel" can be shifted to match different "universes" (Timekeeper, Soundfields, Spiritual, World Builder, Design Patterns, Fusion Lab).
*   **Key Features & Effects:**
    *   **4D Hypercube Projection:** The core of the visualizer is a fragment shader that projects a 4D hypercube into 3D space. It includes functions for 4D rotations (`rotateXW`, `rotateYW`, `rotateZW`) and projection (`project4Dto3D`).
    *   **Lattice Generation:** The `hypercubeLattice` function in the shader generates the grid lines and vertices, which can be morphed and distorted.
    *   **RGB Glitch Effect:** The shader applies an RGB color splitting effect by offsetting the red, green, and blue channels, controlled by `u_glitchIntensity`.
    *   **Moiré Patterns:** The shader creates moiré patterns by overlaying slightly offset grids, controlled by `u_patternIntensity`.
    *   **Universe-Specific Coloring:** The `getUniverseBaseColor` and `getUniverseLatticeColor` functions in the shader dynamically generate colors based on a `u_colorShift` uniform, allowing for thematic color changes.
    *   **Interactive Control:** The JavaScript code connects various UI elements (sliders, mouse movement, keyboard, etc.) to the shader's uniforms, enabling real-time manipulation of the visual effects.
    *   **Time-Based Animation:** The `u_time` uniform drives continuous animations like rotation and subtle distortions.
*   **Key Parameters/Settings (Shader Uniforms):**
    *   `u_resolution`: Canvas resolution.
    *   `u_time`: Elapsed time for animations.
    *   `u_mouse`: Mouse coordinates for interaction.
    *   `u_morphFactor`: Controls the morphing of the lattice.
    *   `u_glitchIntensity`: Controls the RGB color separation.
    *   `u_rotationSpeed`: Controls the rotation speed.
    *   `u_dimension`: Controls the 3D to 4D projection.
    *   `u_gridDensity`: Controls the density of the lattice.
    *   `u_universeModifier`: Affects the contrast and intensity of the lattice.
    *   `u_colorShift`: Controls the hue of the lattice colors.
    *   `u_patternIntensity`: Controls the blending of moiré patterns.
*   **Code Highlights:**

    *   **Fragment Shader (`fragmentShaderSource` in `app.js`):**
        ```glsl
        // Create a hypercube (tesseract) lattice
        float hypercubeLattice(vec3 p, float morphFactor, float gridSize) {
            // ...
            // Apply 4D rotation projection when morphing to a hypercube
            if (u_dimension > 3.0) {
                // ... 4D transformations ...
            }
            // ...
            return result;
        }

        // Get universe-specific color schemes
        vec3 getUniverseBaseColor() {
            float hue = u_colorShift;
            // ... HSV to RGB conversion ...
            return color * 0.15;
        }

        vec3 getUniverseLatticeColor() {
            float hue = u_colorShift;
            // ... HSV to RGB conversion ...
            return color * 0.9 + 0.1;
        }

        void main() {
            // ...
            // Apply RGB color splitting for glitch effect
            float glitchAmount = u_glitchIntensity * (0.1 + 0.1 * sin(u_time * 5.0));
            // ...
            // Create moiré pattern by overlaying slightly offset grids
            float moireGrid1 = hypercubeLattice(p, u_morphFactor, u_gridDensity * 1.01);
            float moireGrid2 = hypercubeLattice(p, u_morphFactor, u_gridDensity * 0.99);
            float moire = abs(moireGrid1 - moireGrid2) * 0.5;
            // ...
            vec3 color = mix(baseColor, latticeColor, vec3(r, g, b));
            // ...
        }
        ```

    *   **JavaScript (Timekeeper Tab - Interaction with Shader):**
        ```javascript
        function updateTimePosition(e) {
            // ...
            effect.morphFactor = 0.3 + percentage * 0.7;
            effect.dimension = 3 + percentage;
            effect.rotationSpeed = 0.2 + percentage * 0.6;
            // ...
        }
        ```
