#!/usr/bin/env python3
"""Generate a minimal valid placeholder PDF (peraturan-pasanggiri.pdf)."""
import os

text_lines = [
    "Peraturan Pasanggiri Persinas ASAD",
    "",
    "Ini adalah berkas placeholder.",
    "Ganti file peraturan-pasanggiri.pdf dengan",
    "dokumen peraturan resmi event Anda.",
]


def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def main():
    content = "BT /F1 16 Tf 60 760 Td 22 TL\n"
    for ln in text_lines:
        content += "(" + esc(ln) + ") Tj T*\n"
    content += "ET"
    cb = content.encode("latin-1")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(cb)).encode() + b" >>\nstream\n" + cb + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, start=1):
        offsets.append(len(pdf))
        pdf += str(i).encode() + b" 0 obj\n" + o + b"\nendobj\n"

    xref_pos = len(pdf)
    pdf += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n"
    pdf += b"0000000000 65535 f \n"
    for off in offsets:
        pdf += ("%010d 00000 n \n" % off).encode()
    pdf += (b"trailer\n<< /Size " + str(len(objs) + 1).encode() +
            b" /Root 1 0 R >>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF")

    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "peraturan-pasanggiri.pdf")
    with open(out, "wb") as f:
        f.write(pdf)
    print("PDF bytes:", len(pdf))


if __name__ == "__main__":
    main()
