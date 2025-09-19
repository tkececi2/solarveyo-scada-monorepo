from PIL import Image, ImageDraw, ImageFont
import os

# Icon boyutları
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    # Yeni görüntü oluştur - gradient arka plan
    img = Image.new('RGB', (size, size), color='#1976d2')
    draw = ImageDraw.Draw(img)
    
    # Gradient efekti için (mavi tonları)
    for i in range(size):
        # #1976d2'den #0d47a1'e yumuşak geçiş
        r = int(25 - (12 * i / size))  
        g = int(118 - (47 * i / size))
        b = int(210 - (49 * i / size))
        color = f'#{r:02x}{g:02x}{b:02x}'
        draw.line([(0, i), (size, i)], fill=color)
    
    # Font boyutunu ayarla
    try:
        # Ana yazı için font boyutu
        font_size = size // 5
        font = ImageFont.truetype("arial.ttf", font_size)
        # Alt yazı için daha küçük font
        font_small = ImageFont.truetype("arial.ttf", font_size // 3)
    except:
        font = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # SolarVeyo yazısını tam ortala
    # Solar yazısı (beyaz)
    text1 = "Solar"
    bbox1 = draw.textbbox((0, 0), text1, font=font)
    text1_width = bbox1[2] - bbox1[0]
    text1_height = bbox1[3] - bbox1[1]
    
    # Veyo yazısı (sarı)
    text2 = "Veyo"
    bbox2 = draw.textbbox((0, 0), text2, font=font)
    text2_width = bbox2[2] - bbox2[0]
    
    # Toplam genişlik ve yatay ortalama
    total_width = text1_width + text2_width
    start_x = (size - total_width) // 2
    
    # SCADA yazısı için alan hesapla
    if size >= 144:
        scada_text = "SCADA"
        bbox_scada = draw.textbbox((0, 0), scada_text, font=font_small)
        scada_height = bbox_scada[3] - bbox_scada[1]
        
        # Toplam yükseklik (ana yazı + boşluk + alt yazı)
        total_height = text1_height + (size // 20) + scada_height
        
        # Dikey ortalama
        start_y = (size - total_height) // 2
    else:
        # Küçük icon'larda sadece ana yazı
        start_y = (size - text1_height) // 2
    
    # SolarVeyo yazısını çiz
    draw.text((start_x, start_y), text1, fill='white', font=font)
    draw.text((start_x + text1_width, start_y), text2, fill='#FFC107', font=font)
    
    # SCADA alt yazısı (orta ve büyük icon'larda)
    if size >= 144:
        scada_text = "SCADA"
        bbox_scada = draw.textbbox((0, 0), scada_text, font=font_small)
        scada_width = bbox_scada[2] - bbox_scada[0]
        scada_x = (size - scada_width) // 2
        scada_y = start_y + text1_height + (size // 20)
        draw.text((scada_x, scada_y), scada_text, fill='#b3e5fc', font=font_small)
    
    # Köşeleri yumuşat (rounded corners efekti için)
    if size >= 192:
        # Köşelere hafif vignette efekti
        corner_radius = size // 16
        for x in range(corner_radius):
            for y in range(corner_radius):
                # Sol üst köşe
                dist = ((x - corner_radius) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((x, y), (13, 71, 161))
                # Sağ üst köşe
                dist = ((size - x - 1 - corner_radius) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((size - x - 1, y), (13, 71, 161))
                # Sol alt köşe
                dist = ((x - corner_radius) ** 2 + (size - y - 1 - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((x, size - y - 1), (13, 71, 161))
                # Sağ alt köşe
                dist = ((size - x - 1 - corner_radius) ** 2 + (size - y - 1 - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((size - x - 1, size - y - 1), (13, 71, 161))
    
    # Kaydet
    img.save(f'public/icon-{size}x{size}.png')
    print(f'Created icon-{size}x{size}.png')

# Apple touch icon
img_512 = Image.open('public/icon-512x512.png')
img_180 = img_512.resize((180, 180), Image.Resampling.LANCZOS)
img_180.save('public/apple-touch-icon.png')
print('Created apple-touch-icon.png')

# Favicon (32x32)
img_32 = img_512.resize((32, 32), Image.Resampling.LANCZOS)
img_32.save('public/favicon.ico')
print('Created favicon.ico')

print("\nAll simple logo icons created successfully!")
print("Logos are centered with text only - no sun or panels!")
