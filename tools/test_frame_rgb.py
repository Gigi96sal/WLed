import tempfile
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from frame_rgb import SUPPORTED_SIZES, build_frame, generate, parse_size, read_ppm, resize_nearest


def write_ppm(path: Path, width: int, height: int, color_for):
    pixels = bytes(channel for y in range(height) for x in range(width) for channel in color_for(x, y))
    path.write_bytes(f"P6\n{width} {height}\n255\n".encode("ascii") + pixels)


class FrameRgbTests(unittest.TestCase):
    def test_supported_sizes(self):
        self.assertEqual(SUPPORTED_SIZES, ((11, 22), (22, 33)))
        self.assertEqual(parse_size("22X33"), (22, 33))
        with self.assertRaises(Exception):
            parse_size("12x24")

    def test_frame_contains_four_independent_sides(self):
        frame = build_frame(11, 22, [(255, 20, 10)] * (11 * 22))
        self.assertEqual(len(frame), 2 * (11 + 22))
        self.assertEqual(frame, [(255, 20, 10)] * len(frame))

    def test_frame_order(self):
        pixels = [(x, y, 0) for y in range(3) for x in range(4)]
        frame = build_frame(4, 3, pixels)
        expected = [
            (1, 0, 0), (1, 0, 0), (2, 0, 0), (2, 0, 0),
            (3, 1, 0), (3, 1, 0), (3, 1, 0),
            (2, 2, 0), (2, 2, 0), (1, 2, 0), (1, 2, 0),
            (0, 1, 0), (0, 1, 0), (0, 1, 0),
        ]
        self.assertEqual(frame, expected)

    def test_frame_does_not_sample_image_corners(self):
        pixels = [(x, y, 0) for y in range(33) for x in range(22)]
        frame = build_frame(22, 33, pixels)
        self.assertEqual(len(frame), 110)
        self.assertNotIn((0, 0, 0), frame)
        self.assertNotIn((21, 0, 0), frame)
        self.assertNotIn((0, 32, 0), frame)
        self.assertNotIn((21, 32, 0), frame)

    def test_resize_and_ppm_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.ppm"
            output = Path(directory) / "frame_rgb.h"
            write_ppm(source, 2, 2, lambda x, y: (x * 100, y * 100, 50))
            image_width, image_height, pixels = read_ppm(source)
            resized = resize_nearest(image_width, image_height, pixels, 11, 22)
            self.assertEqual(len(resized), 11 * 22)
            generate(source, output, 11, 22, "frameRgbData")
            text = output.read_text(encoding="ascii")
            self.assertIn("#define FRAME_RGB_WIDTH 11", text)
            self.assertIn("#define FRAME_RGB_HEIGHT 22", text)
            self.assertIn("#define FRAME_RGB_PIXEL_COUNT 66", text)
            self.assertEqual(text.count("0x"), 66 * 3)

    def test_preview_generation(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow is not installed")

        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.ppm"
            output = Path(directory) / "frame_rgb.h"
            preview = Path(directory) / "frame_rgb_preview.png"
            write_ppm(source, 8, 6, lambda x, y: (x * 20, y * 30, 50))
            generate(source, output, 11, 22, "frameRgbData", preview)
            self.assertTrue(preview.is_file())
            with Image.open(preview) as image:
                self.assertEqual(image.size, (8, 6))


if __name__ == "__main__":
    unittest.main()