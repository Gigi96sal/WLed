# FrameRGB Editor

A standalone browser editor for placing and exporting the 110 colors used by the WLED FrameRGB effect.

## Run

From the repository root:

```powershell
python -m http.server 8000 --directory tools/frame_rgb_editor
```

Open <http://localhost:8000> in a browser.

## Workflow

1. Open a reference image.
2. Choose `2:3` (`22 x 33`) or `3:2` (`33 x 22`).
3. Use `Zoom`, the mouse wheel, and drag the image to inspect areas closely. Drag the crop frame to reposition it.
4. Drag any of the 110 markers to refine its sample location. The marker fill is the sampled color.
5. Use the saturation slider to adjust all sampled colors without changing the background image.
6. Toggle `LED color correction` to keep chromatic colors vivid and prevent pale photographic colors from becoming weak on an LED strip. Neutral colors remain unchanged.
7. Choose a crop ratio and size, then use `Crop, save & open image`. The output is named `original-cropped.ext` and becomes the active editor image.
8. Click `Choose element 0`, then click a marker. Click `Choose element 1`, then click the adjacent marker in the physical strip direction.
9. Export the generated `.h` file.

The tooltip shows the exported LED number, adjusted RGB value, and normalized image coordinates. The four physical sides are independent; image corners are never sampled as marker locations. LED color correction uses a conservative HSL remap: it boosts weak chromatic samples and limits excessive lightness, while leaving near-gray samples alone.
