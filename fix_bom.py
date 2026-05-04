#!/usr/bin/env python3
"""Fix UTF-16/UTF-32 BOM in Java source files."""
import os
import glob

BOM_SIGNATURES = {
    b'\xef\xbb\xbf': 'UTF-8',
    b'\xff\xfe': 'UTF-16-LE',
    b'\xfe\xff': 'UTF-16-BE',
    b'\xff\xfe\x00\x00': 'UTF-32-LE',
    b'\x00\x00\xfe\xff': 'UTF-32-BE',
}

def fix_bom(filepath):
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    for bom, encoding in BOM_SIGNATURES.items():
        if raw.startswith(bom):
            print(f"Converting {filepath} from {encoding} to UTF-8")
            content = raw[len(bom):].decode('utf-8', errors='replace')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    return False

src_dir = '/app/backend/src'
for root, _, files in os.walk(src_dir):
    for filename in files:
        if filename.endswith('.java'):
            filepath = os.path.join(root, filename)
            fix_bom(filepath)

print("BOM fix completed.")