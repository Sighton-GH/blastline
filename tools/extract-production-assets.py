"""Deterministically crop approved BLASTLINE source masters into runtime WebP assets.

The source sheets remain untouched under assets/source/blastline. This script only
crops transparent, text-free art and downsizes it for the browser runtime.
"""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "blastline"
RUNTIME = ROOT / "assets" / "blastline"


ASSETS = (
    ("09-branding-master.png", (18, 12, 1145, 520), "branding/logo-primary.webp", (900, 420)),
    # Top-row rear-facing run cycle. The lower edge stops before the aiming row.
    ("02-player-swat-master.png", (120, 0, 325, 282), "characters/player-run-1.webp", (190, 290)),
    ("02-player-swat-master.png", (365, 0, 550, 282), "characters/player-run-2.webp", (190, 290)),
    ("02-player-swat-master.png", (575, 0, 775, 282), "characters/player-run-3.webp", (190, 290)),
    ("02-player-swat-master.png", (790, 0, 995, 282), "characters/player-run-4.webp", (190, 290)),
    # Isolated representatives from each red-faction row. Bounds deliberately
    # exclude neighboring animation frames and the weapon strip below the boss.
    ("03-enemies-elites-boss-master.png", (20, 0, 125, 152), "characters/enemy-grunt.webp", (150, 175)),
    ("03-enemies-elites-boss-master.png", (0, 145, 162, 335), "characters/enemy-elite.webp", (190, 195)),
    ("03-enemies-elites-boss-master.png", (0, 330, 165, 495), "characters/enemy-special.webp", (205, 205)),
    ("03-enemies-elites-boss-master.png", (320, 500, 625, 855), "characters/boss.webp", (330, 390)),
    ("07-upgrade-ui-master.png", (15, 545, 198, 735), "ui/upgrade-troops.webp", (150, 150)),
    ("07-upgrade-ui-master.png", (198, 545, 382, 735), "ui/upgrade-power.webp", (150, 150)),
    ("07-upgrade-ui-master.png", (380, 545, 565, 735), "ui/upgrade-rate.webp", (150, 150)),
    ("07-upgrade-ui-master.png", (380, 735, 565, 935), "ui/upgrade-spread.webp", (150, 150)),
    ("07-upgrade-ui-master.png", (565, 545, 750, 735), "ui/upgrade-velocity.webp", (150, 150)),
    ("07-upgrade-ui-master.png", (15, 735, 198, 935), "ui/upgrade-armor.webp", (150, 150)),
)


def trim_transparent(image: Image.Image, threshold: int = 3) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bounds = mask.getbbox()
    return rgba.crop(bounds) if bounds else rgba


def export_asset(source_name: str, box: tuple[int, int, int, int], destination: str, maximum: tuple[int, int]) -> None:
    source_path = SOURCE / source_name
    destination_path = RUNTIME / destination
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as master:
        asset = trim_transparent(master.crop(box))
        asset.thumbnail(maximum, Image.Resampling.LANCZOS)
        asset.save(destination_path, "WEBP", quality=88, method=6, exact=True)
    print(f"{destination_path.relative_to(ROOT)}\t{destination_path.stat().st_size} bytes\t{asset.width}x{asset.height}")


def export_keyed_asset(source_name: str, box: tuple[int, int, int, int], destination: str, maximum: tuple[int, int]) -> None:
    """Remove a neutral sheet backdrop using row-wise edge color interpolation.

    The home master is the one approved sheet delivered without an alpha channel.
    Both crop edges contain only its neutral gray backdrop, which provides a stable
    deterministic background estimate without redrawing or regenerating the art.
    """
    source_path = SOURCE / source_name
    destination_path = RUNTIME / destination
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as master:
        rgb = master.crop(box).convert("RGB")
        width, height = rgb.size
        pixels = rgb.load()
        alpha_values = []
        edge_sample = 8
        for y in range(height):
            left = tuple(sum(pixels[x, y][channel] for x in range(edge_sample)) / edge_sample for channel in range(3))
            right = tuple(sum(pixels[width - 1 - x, y][channel] for x in range(edge_sample)) / edge_sample for channel in range(3))
            for x in range(width):
                amount = x / max(1, width - 1)
                background = tuple(left[channel] + (right[channel] - left[channel]) * amount for channel in range(3))
                distance = sum((pixels[x, y][channel] - background[channel]) ** 2 for channel in range(3)) ** 0.5
                alpha_values.append(max(0, min(255, round((distance - 10) * 13))))
        alpha = Image.new("L", rgb.size)
        alpha.putdata(alpha_values)
        alpha = alpha.filter(ImageFilter.MedianFilter(3))
        asset = rgb.convert("RGBA")
        asset.putalpha(alpha)
        asset = trim_transparent(asset, threshold=5)
        asset.thumbnail(maximum, Image.Resampling.LANCZOS)
        asset.save(destination_path, "WEBP", quality=90, method=6, exact=True)
    print(f"{destination_path.relative_to(ROOT)}\t{destination_path.stat().st_size} bytes\t{asset.width}x{asset.height}")


def main() -> None:
    for spec in ASSETS:
        export_asset(*spec)
    export_keyed_asset("10-home-master.png", (785, 650, 1025, 1085), "characters/home-hero.webp", (360, 600))


if __name__ == "__main__":
    main()
