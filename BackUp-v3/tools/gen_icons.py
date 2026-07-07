#!/usr/bin/env python3
"""Generate PWA PNG icons (no external deps, uses zlib).

Draws a Sundanese-themed icon: dark-green background with a gold
diamond/segi (belah ketupat) motif and an inner ring — evoking a
martial-arts badge. Outputs:
  icons/icon-192.png
  icons/icon-512.png
  icons/icon-maskable-512.png  (extra safe-zone padding)
"""
import struct, zlib, os, math

HIJAU = (27, 67, 50)        # #1B4332
HIJAU_SED = (45, 106, 79)   # #2D6A4F
EMAS = (184, 134, 11)       # #B8860B
EMAS_TERANG = (212, 168, 67)# #D4A843
KREM = (255, 248, 240)      # #FFF8F0


def blend(bg, fg, a):
    return tuple(int(bg[i] * (1 - a) + fg[i] * a) for i in range(3))


def make_icon(size, maskable=False):
    px = bytearray()
    cx = cy = size / 2.0
    # radial background gradient hijau
    motif_scale = 0.62 if maskable else 0.78  # safe zone for maskable
    for y in range(size):
        row = bytearray()
        for x in range(size):
            dx = (x - cx) / cx
            dy = (y - cy) / cy
            d = math.sqrt(dx * dx + dy * dy)
            base = blend(HIJAU_SED, HIJAU, min(1.0, d))
            r, g, b = base

            # normalized distance for motif
            nx = (x - cx) / (cx * motif_scale)
            ny = (y - cy) / (cy * motif_scale)
            diamond = abs(nx) + abs(ny)   # belah ketupat metric
            circ = math.sqrt(nx * nx + ny * ny)

            col = (r, g, b)
            # outer gold ring (circle)
            if 0.92 <= circ <= 1.0:
                col = EMAS
            # diamond outline (gold)
            elif 0.80 <= diamond <= 0.92:
                col = EMAS_TERANG
            # inner diamond fill (krem) with small center diamond gold
            elif diamond < 0.80:
                if diamond < 0.26:
                    col = EMAS
                elif diamond < 0.34:
                    col = HIJAU
                else:
                    col = KREM
            row += bytes(col)
        # PNG filter byte (0) per row
        px += b"\x00" + row
    return png_bytes(size, size, bytes(px))


def png_bytes(w, h, raw_rgb):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit, RGB
    idat = zlib.compress(raw_rgb, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "icons")
    os.makedirs(out, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
    ]
    for name, size, mask in targets:
        data = make_icon(size, mask)
        with open(os.path.join(out, name), "wb") as f:
            f.write(data)
        print("wrote", name, size, len(data), "bytes")


if __name__ == "__main__":
    main()
