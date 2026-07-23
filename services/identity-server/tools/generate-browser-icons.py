from math import acos, atan2, cos, pi, sin, sqrt
from pathlib import Path

from PIL import Image, ImageDraw


PUBLIC_DIR = Path(__file__).resolve().parents[1] / "public"
BASE_SIZE = 64
SUPERSAMPLING = 4


def _svg_arc_points(start, end, radius, large_arc=True, sweep=False, steps=160):
    x1, y1 = start
    x2, y2 = end
    rx = ry = radius
    dx = (x1 - x2) / 2
    dy = (y1 - y2) / 2
    scale = max(1, sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)))
    rx *= scale
    ry *= scale
    root_numerator = max(0, rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx)
    root_denominator = rx * rx * dy * dy + ry * ry * dx * dx
    coefficient = (-1 if large_arc == sweep else 1) * sqrt(root_numerator / root_denominator)
    cx = coefficient * (rx * dy / ry) + (x1 + x2) / 2
    cy = coefficient * (-ry * dx / rx) + (y1 + y2) / 2

    ux, uy = (x1 - cx) / rx, (y1 - cy) / ry
    vx, vy = (x2 - cx) / rx, (y2 - cy) / ry
    start_angle = atan2(uy, ux)
    delta_angle = acos(max(-1, min(1, ux * vx + uy * vy)))
    if ux * vy - uy * vx < 0:
        delta_angle = -delta_angle
    if not sweep and delta_angle > 0:
        delta_angle -= 2 * pi
    if sweep and delta_angle < 0:
        delta_angle += 2 * pi
    return [
        (
            cx + rx * cos(start_angle + delta_angle * index / steps),
            cy + ry * sin(start_angle + delta_angle * index / steps),
        )
        for index in range(steps + 1)
    ]


def _scaled_points(points, scale):
    return [(round(x * scale), round(y * scale)) for x, y in points]


def _rounded_line(draw, points, fill, width):
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def render_icon(size):
    canvas_size = size * SUPERSAMPLING
    scale = canvas_size / BASE_SIZE
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, canvas_size - 1, canvas_size - 1),
        radius=round(15 * scale),
        fill="#07111e",
    )

    g_points = _svg_arc_points((31, 20), (32, 45), 17)
    g_points.extend([(32, 33), (20, 33)])
    _rounded_line(draw, _scaled_points(g_points, scale), "#f5f8fb", round(7 * scale))

    x_mask = Image.new("L", image.size, 0)
    x_draw = ImageDraw.Draw(x_mask)
    width = round(8 * scale)
    _rounded_line(x_draw, _scaled_points([(38, 18), (58, 46)], scale), 255, width)
    _rounded_line(x_draw, _scaled_points([(58, 18), (38, 46)], scale), 255, width)
    gradient = Image.new("RGBA", image.size)
    gradient_pixels = gradient.load()
    for y in range(canvas_size):
        for x in range(canvas_size):
            progress = (x + y) / max(1, 2 * canvas_size - 2)
            gradient_pixels[x, y] = (
                round(98 + (35 - 98) * progress),
                round(230 + (120 - 230) * progress),
                round(244 + (239 - 244) * progress),
                255,
            )
    image.alpha_composite(Image.composite(gradient, Image.new("RGBA", image.size), x_mask))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main():
    icons = {
        "gernetix-gx-browser-32.png": 32,
        "gernetix-gx-apple-touch.png": 180,
        "gernetix-gx-app-192.png": 192,
        "gernetix-gx-app-512.png": 512,
    }
    rendered = {}
    for filename, size in icons.items():
        rendered[size] = render_icon(size)
        rendered[size].save(PUBLIC_DIR / filename, format="PNG", optimize=True)
    render_icon(256).save(
        PUBLIC_DIR / "gernetix-gx-browser.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    main()
