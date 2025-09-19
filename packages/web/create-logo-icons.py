from PIL import Image, ImageDraw, ImageFont
import os

# Icon boyutları
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    # Yeni görüntü oluştur - gradient arka plan
    img = Image.new('RGB', (size, size), color='#1976d2')
    draw = ImageDraw.Draw(img)
    
    # Gradient efekti için
    for i in range(size):
        color_value = int(25 + (6 * i / size))  # #1976d2'den #0d47a1'e geçiş
        color = f'#{color_value:02x}47a1'
        draw.line([(0, i), (size, i)], fill=color)
    
    # Güneş paneli çiz (koyu gri dikdörtgen)
    panel_width = int(size * 0.6)
    panel_height = int(size * 0.35)
    panel_x = (size - panel_width) // 2
    panel_y = int(size * 0.35)
    draw.rectangle([panel_x, panel_y, panel_x + panel_width, panel_y + panel_height], 
                   fill='#37474f', outline='#263238', width=1)
    
    # Panel çizgileri
    grid_cols = 4
    grid_rows = 3
    for i in range(1, grid_cols):
        x = panel_x + (panel_width * i // grid_cols)
        draw.line([(x, panel_y), (x, panel_y + panel_height)], fill='#546e7a', width=1)
    for i in range(1, grid_rows):
        y = panel_y + (panel_height * i // grid_rows)
        draw.line([(panel_x, y), (panel_x + panel_width, y)], fill='#546e7a', width=1)
    
    # Güneş çiz (sarı daire)
    sun_radius = size // 10
    sun_x = size // 2
    sun_y = int(size * 0.2)
    sun_box = [sun_x - sun_radius, sun_y - sun_radius, 
               sun_x + sun_radius, sun_y + sun_radius]
    draw.ellipse(sun_box, fill='#FFC107')
    
    # Güneş ışınları
    import math
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x1 = sun_x + math.cos(rad) * (sun_radius + 5)
        y1 = sun_y + math.sin(rad) * (sun_radius + 5)
        x2 = sun_x + math.cos(rad) * (sun_radius + 10)
        y2 = sun_y + math.sin(rad) * (sun_radius + 10)
        draw.line([(x1, y1), (x2, y2)], fill='#FFC107', width=max(1, size//100))
    
    # SolarVeyo yazısı
    try:
        font_size = size // 8
        font = ImageFont.truetype("arial.ttf", font_size)
        font_small = ImageFont.truetype("arial.ttf", font_size // 2)
    except:
        font = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Solar yazısı (beyaz)
    text1 = "Solar"
    bbox1 = draw.textbbox((0, 0), text1, font=font)
    text1_width = bbox1[2] - bbox1[0]
    
    # Veyo yazısı (sarı)
    text2 = "Veyo"
    bbox2 = draw.textbbox((0, 0), text2, font=font)
    text2_width = bbox2[2] - bbox2[0]
    
    # Toplam genişlik ve konumlandırma
    total_width = text1_width + text2_width
    start_x = (size - total_width) // 2
    text_y = int(size * 0.75)
    
    draw.text((start_x, text_y), text1, fill='white', font=font)
    draw.text((start_x + text1_width, text_y), text2, fill='#FFC107', font=font)
    
    # SCADA alt yazısı (sadece büyük icon'larda)
    if size >= 192:
        scada_text = "SCADA"
        bbox_scada = draw.textbbox((0, 0), scada_text, font=font_small)
        scada_width = bbox_scada[2] - bbox_scada[0]
        scada_x = (size - scada_width) // 2
        scada_y = text_y + font_size + 2
        draw.text((scada_x, scada_y), scada_text, fill='#b3e5fc', font=font_small)
    
    # Kaydet
    img.save(f'public/icon-{size}x{size}.png')
    print(f'Created icon-{size}x{size}.png')

# Apple touch icon
img_512 = Image.open('public/icon-512x512.png')
img_180 = img_512.resize((180, 180), Image.Resampling.LANCZOS)
img_180.save('public/apple-touch-icon.png')
print('Created apple-touch-icon.png')

# Favicon
img_32 = img_512.resize((32, 32), Image.Resampling.LANCZOS)
img_32.save('public/favicon.ico')
print('Created favicon.ico')

print("\nAll logo icons created successfully!")
