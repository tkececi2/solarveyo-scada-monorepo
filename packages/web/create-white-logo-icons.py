from PIL import Image, ImageDraw, ImageFont
import os

# Icon boyutları
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    # Yeni görüntü oluştur - beyaz arka plan
    img = Image.new('RGB', (size, size), color='#ffffff')
    draw = ImageDraw.Draw(img)
    
    # Hafif kenar gölgesi için çerçeve
    draw.rectangle([0, 0, size-1, size-1], outline='#f0f0f0', width=1)
    
    # Font boyutunu ayarla
    try:
        # Ana yazı için font boyutu
        font_size = size // 5
        font = ImageFont.truetype("arial.ttf", font_size)
        font_bold = ImageFont.truetype("arialbd.ttf", font_size)  # Bold font
        # Alt yazı için daha küçük font
        font_small = ImageFont.truetype("arial.ttf", font_size // 3)
        font_small_bold = ImageFont.truetype("arialbd.ttf", font_size // 3)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
            font_bold = font
            font_small = ImageFont.truetype("arial.ttf", font_size // 3)
            font_small_bold = font_small
        except:
            font = ImageFont.load_default()
            font_bold = font
            font_small = ImageFont.load_default()
            font_small_bold = font_small
    
    # SolarVeyo yazısını tam ortala
    # Solar yazısı (siyah)
    text1 = "Solar"
    bbox1 = draw.textbbox((0, 0), text1, font=font_bold)
    text1_width = bbox1[2] - bbox1[0]
    text1_height = bbox1[3] - bbox1[1]
    
    # Veyo yazısı (mavi)
    text2 = "Veyo"
    bbox2 = draw.textbbox((0, 0), text2, font=font_bold)
    text2_width = bbox2[2] - bbox2[0]
    
    # Toplam genişlik ve yatay ortalama
    total_width = text1_width + text2_width
    start_x = (size - total_width) // 2
    
    # SCADA yazısı için alan hesapla
    if size >= 144:
        scada_text = "SCADA"
        bbox_scada = draw.textbbox((0, 0), scada_text, font=font_small_bold)
        scada_height = bbox_scada[3] - bbox_scada[1]
        
        # Toplam yükseklik (ana yazı + boşluk + alt yazı)
        total_height = text1_height + (size // 20) + scada_height
        
        # Dikey ortalama
        start_y = (size - total_height) // 2
    else:
        # Küçük icon'larda sadece ana yazı
        start_y = (size - text1_height) // 2
    
    # SolarVeyo yazısını çiz
    draw.text((start_x, start_y), text1, fill='#000000', font=font_bold)  # Siyah
    draw.text((start_x + text1_width, start_y), text2, fill='#1976d2', font=font_bold)  # Mavi
    
    # SCADA alt yazısı (orta ve büyük icon'larda) - siyah
    if size >= 144:
        scada_text = "SCADA"
        bbox_scada = draw.textbbox((0, 0), scada_text, font=font_small_bold)
        scada_width = bbox_scada[2] - bbox_scada[0]
        scada_x = (size - scada_width) // 2
        scada_y = start_y + text1_height + (size // 20)
        draw.text((scada_x, scada_y), scada_text, fill='#000000', font=font_small_bold)  # Siyah
    
    # Çok büyük icon'larda "Monitoring System" ekle
    if size >= 384:
        monitor_text = "Monitoring System"
        try:
            font_tiny = ImageFont.truetype("arial.ttf", font_size // 5)
        except:
            font_tiny = font_small
        bbox_monitor = draw.textbbox((0, 0), monitor_text, font=font_tiny)
        monitor_width = bbox_monitor[2] - bbox_monitor[0]
        monitor_x = (size - monitor_width) // 2
        monitor_y = scada_y + scada_height + (size // 30)
        draw.text((monitor_x, monitor_y), monitor_text, fill='#666666', font=font_tiny)  # Gri
    
    # Köşeleri hafif yuvarlat
    if size >= 192:
        corner_radius = size // 32
        # Köşelere çok hafif yumuşatma
        for x in range(corner_radius):
            for y in range(corner_radius):
                # Sol üst köşe
                dist = ((x - corner_radius) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((x, y), (250, 250, 250))
                # Sağ üst köşe
                dist = ((size - x - 1 - corner_radius) ** 2 + (y - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((size - x - 1, y), (250, 250, 250))
                # Sol alt köşe
                dist = ((x - corner_radius) ** 2 + (size - y - 1 - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((x, size - y - 1), (250, 250, 250))
                # Sağ alt köşe
                dist = ((size - x - 1 - corner_radius) ** 2 + (size - y - 1 - corner_radius) ** 2) ** 0.5
                if dist > corner_radius:
                    img.putpixel((size - x - 1, size - y - 1), (250, 250, 250))
    
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

print("\nAll white background logo icons created successfully!")
print("Colors: White background, Black 'Solar' & 'SCADA', Blue 'Veyo'")
