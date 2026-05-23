import sys
import os

sys.path.insert(0, r'c:\Users\Admin\Desktop\PRISMSCALE_IT\branding\prismscale-backend')
from render import build_section_entries, evaluate_condition

data = {
  "brand_name": "My Brand",
  "brand_logo_url": "url1",
  "brand_hero_image_url": "url2",
  "about_client_about": "text",
  "logo_download_all_logos": "url3",
  "logo_vertical_download_link": "url4",
  "colors_primary_1_hex": "#ffffff",
  "colors_secondary_1_hex": "#000000",
  "typography_primary_1_name": "Arial",
  "typography_secondary_1_name": "Times New Roman",
  "section_order": ["brand", "about", "logo", "colors", "typography", "illustrations", "images", "patterns", "collaterals", "guidelines"]
}

rendered_partials = {
  "brand": "1",
  "about": "1",
  "logo": "1",
  "colors": "1",
  "typography": "1",
  "illustrations": "1",
  "images": "1",
  "patterns": "1",
  "collaterals": "1",
  "guidelines": "1"
}

entries = build_section_entries(data, rendered_partials)
for e in entries:
    print(e)
