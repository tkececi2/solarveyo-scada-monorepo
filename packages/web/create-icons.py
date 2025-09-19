from PIL import Image, ImageDraw, ImageFont
import os

# Icon boyutları
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    # Yeni görüntü oluştur
    img = Image.new('RGB', (size, size), color='#1976d2')
    draw = ImageDraw.Draw(img)
    
    # Güneş çiz (sarı daire)
    sun_radius = size // 4
    sun_center = (size // 2, size // 2)
    sun_box = [
        sun_center[0] - sun_radius,
        sun_center[1] - sun_radius,
        sun_center[0] + sun_radius,
        sun_center[1] + sun_radius
    ]
    draw.ellipse(sun_box, fill='#FFC107')
    
    # SV yazısı
    try:
        font_size = size // 5
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "SV"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2
    draw.text((text_x, text_y), text, fill='white', font=font)
    
    # Kaydet
    img.save(f'public/icon-{size}x{size}.png')
    print(f'Created icon-{size}x{size}.png')

print("All icons created successfully!")
