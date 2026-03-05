#!/usr/bin/env python3
"""
Simple script to generate placeholder icons for the Chrome extension.
Requires Pillow: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow is required. Install it with: pip install Pillow")
    exit(1)

def create_icon(size, filename):
    # Create image with gradient blue background
    img = Image.new('RGB', (size, size), color='#4f8ef7')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple document icon (white rectangle with folded corner)
    margin = size // 4
    doc_width = size - 2 * margin
    doc_height = size - 2 * margin
    
    # Main document rectangle
    draw.rectangle(
        [margin, margin, margin + doc_width, margin + doc_height],
        fill='white',
        outline=None
    )
    
    # Folded corner (triangle)
    corner_size = size // 6
    draw.polygon(
        [
            (margin, margin),
            (margin + corner_size, margin),
            (margin, margin + corner_size)
        ],
        fill='#e0e4eb'
    )
    
    # Save icon
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

if __name__ == '__main__':
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')
    print("All icons generated successfully!")
