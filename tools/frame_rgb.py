#!/usr/bin/env python3
"""Generate a 1D FrameRGB frame from a poster image.

The image is resized to the requested dimensions, then four independent sides
are emitted clockwise. The physical sides do not share corner LEDs, so each
side is sampled just inside the corresponding image edge.
"""

from __future__ import annotations

import argparse
from pathlib import Path

SUPPORTED_SIZES = ((11, 22), (22, 33))
FORMAT_VERSION = 1


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = (int(part) for part in value.lower().split("x"))
    except (TypeError, ValueError):
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT") from None
    if (width, height) not in SUPPORTED_SIZES:
        choices = ", ".join(f"{w}x{h}" for w, h in SUPPORTED_SIZES)
        raise argparse.ArgumentTypeError(f"size must be one of: {choices}")
    return width, height


def read_ppm(path: Path) -> tuple[int, int, list[tuple[int, int, int]]]:
    """Read a binary PPM (P6) image without third-party packages."""
    data = path.read_bytes()
    tokens: list[bytes] = []
    index = 0
    while len(tokens) < 4:
        while index < len(data) and data[index] in b" \t\r\n":
            index += 1
        if index >= len(data):
            raise ValueError("invalid PPM header")
        if data[index] == ord("#"):
            end = data.find(b"\n", index)
            index = len(data) if end < 0 else end + 1
            continue
        end = index
        while end < len(data) and data[end] not in b" \t\r\n":
            end += 1
        tokens.append(data[index:end])
        index = end
    if tokens[0] != b"P6" or tokens[3] != b"255":
        raise ValueError("only binary PPM (P6) with max value 255 is supported")
    width, height = int(tokens[1]), int(tokens[2])
    if index >= len(data) or data[index] not in b" \t\r\n":
        raise ValueError("invalid PPM pixel data separator")
    index += 1
    payload = data[index:]
    expected = width * height * 3
    if len(payload) != expected:
        raise ValueError("PPM pixel data has an unexpected length")
    pixels = [tuple(payload[i:i + 3]) for i in range(0, expected, 3)]
    return width, height, pixels


def load_image(path: Path) -> tuple[int, int, list[tuple[int, int, int]]]:
    """Load a PPM directly or use Pillow for common photo formats."""
    if path.suffix.lower() == ".ppm":
        return read_ppm(path)
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("Pillow is required for non-PPM images: python -m pip install Pillow") from error
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        return rgb.width, rgb.height, list(rgb.getdata())


def resize_nearest(width: int, height: int, pixels: list[tuple[int, int, int]], target_width: int, target_height: int) -> list[tuple[int, int, int]]:
    if width <= 0 or height <= 0 or len(pixels) != width * height:
        raise ValueError("image dimensions and pixel data do not match")
    resized = []
    for y in range(target_height):
        source_y = min(height - 1, y * height // target_height)
        for x in range(target_width):
            source_x = min(width - 1, x * width // target_width)
            resized.append(pixels[source_y * width + source_x])
    return resized


def edge_coordinate(index: int, count: int, end: int) -> int:
    position = (index + 1) * end / (count + 1)
    return max(1, min(end - 1, round(position)))


def build_frame_coordinates(width: int, height: int) -> list[tuple[int, int]]:
    """Return the resized-image coordinates for the four physical sides."""
    if width < 2 or height < 2:
        raise ValueError("image dimensions must be at least 2x2")

    coordinates = []
    coordinates.extend((edge_coordinate(index, width, width - 1), 0) for index in range(width))
    coordinates.extend(
        (width - 1, edge_coordinate(index, height, height - 1))
        for index in range(height)
    )
    coordinates.extend(
        (edge_coordinate(index, width, width - 1), height - 1)
        for index in range(width - 1, -1, -1)
    )
    coordinates.extend(
        (0, edge_coordinate(index, height, height - 1))
        for index in range(height - 1, -1, -1)
    )
    return coordinates


def build_frame(width: int, height: int, pixels: list[tuple[int, int, int]]) -> list[tuple[int, int, int]]:
    """Return four non-overlapping physical sides in clockwise order.

    Side endpoints are sampled inside the image corners because the physical
    LED runs stop short of the corners. The four side lengths are width,
    height, width, and height, for a total of 2 * (width + height) LEDs.
    """
    if width < 2 or height < 2 or len(pixels) != width * height:
        raise ValueError("image dimensions and pixel data do not match")

    coordinates = build_frame_coordinates(width, height)
    return [pixels[y * width + x] for x, y in coordinates]


def save_preview(input_path: Path, output_path: Path, width: int, height: int) -> None:
    """Save the source image with the selected LED coordinates overlaid."""
    try:
        from PIL import Image, ImageDraw
    except ImportError as error:
        raise RuntimeError("Pillow is required for preview output: python -m pip install Pillow") from error

    with Image.open(input_path) as source:
        image = source.convert("RGB")
        source_width, source_height = image.size
        draw = ImageDraw.Draw(image)
        marker_radius = max(3, round(min(source_width, source_height) / 100))
        coordinates = build_frame_coordinates(width, height)
        resized_pixels = resize_nearest(
            source_width,
            source_height,
            list(image.getdata()),
            width,
            height,
        )
        for (x, y), color in zip(coordinates, (resized_pixels[y * width + x] for x, y in coordinates)):
            source_x = round(x * (source_width - 1) / (width - 1))
            source_y = round(y * (source_height - 1) / (height - 1))
            bounds = (
                source_x - marker_radius,
                source_y - marker_radius,
                source_x + marker_radius,
                source_y + marker_radius,
            )
            draw.ellipse(bounds, fill=color, outline=(0, 0, 0), width=max(1, marker_radius // 3))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)


def format_header(name: str, width: int, height: int, frame: list[tuple[int, int, int]]) -> str:
    values = ", ".join(f"0x{channel:02X}" for color in frame for channel in color)
    return f"""#pragma once

// Generated by tools/frame_rgb.py. Do not edit manually.
#define FRAME_RGB_AVAILABLE 1
#define FRAME_RGB_FORMAT_VERSION {FORMAT_VERSION}
#define FRAME_RGB_WIDTH {width}
#define FRAME_RGB_HEIGHT {height}
#define FRAME_RGB_PIXEL_COUNT {len(frame)}

static const uint8_t {name}[FRAME_RGB_PIXEL_COUNT * 3] PROGMEM = {{
  {values}
}};
"""


def generate(input_path: Path, output_path: Path, width: int, height: int, symbol: str, preview_output: Path | None = None) -> None:
    image_width, image_height, pixels = load_image(input_path)
    resized = resize_nearest(image_width, image_height, pixels, width, height)
    frame = build_frame(width, height, resized)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(format_header(symbol, width, height, frame), encoding="ascii")
    if preview_output is not None:
        save_preview(input_path, preview_output, width, height)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="input image (PPM, or a Pillow-supported photo format)")
    parser.add_argument("--size", required=True, type=parse_size, help="poster matrix: 11x22 or 22x33")
    parser.add_argument("--output", required=True, type=Path, help="generated C++ header path")
    parser.add_argument("--preview-output", type=Path, help="optional annotated image showing the selected LED samples")
    parser.add_argument("--symbol", default="frameRgbData", help="C++ array symbol")
    args = parser.parse_args()
    if not args.image.is_file():
        parser.error(f"input image does not exist: {args.image}")
    try:
        generate(args.image, args.output, *args.size, args.symbol, args.preview_output)
    except (OSError, RuntimeError, ValueError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())