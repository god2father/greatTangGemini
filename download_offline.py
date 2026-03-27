import os
import urllib.request
import re
import json
import shutil

def download_file(url, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        urllib.request.urlretrieve(url, filepath)
        print("Downloaded: {}".format(filepath))
    except Exception as e:
        print("Failed to download {}: {}".format(url, e))

def main():
    base_dir = r"d:\work\greatTangGemini"
    
    print("Downloading Three.js...")
    three_version = "0.162.0"
    three_base_url = "https://cdn.jsdelivr.net/npm/three@{}".format(three_version)
    
    # Core
    download_file("{}/build/three.module.js".format(three_base_url), os.path.join(base_dir, "lib", "three", "build", "three.module.js"))
    
    print("Downloading Google Fonts CSS...")
    fonts_url = "https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&display=swap"
    req = urllib.request.Request(fonts_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    try:
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
    except Exception as e:
        print("Failed to fetch fonts CSS: {}".format(e))
        return
        
    font_folder = os.path.join(base_dir, "fonts")
    os.makedirs(font_folder, exist_ok=True)
    
    urls = re.findall(r'url\((https://[^)]+)\)', css_content)
    unique_urls = list(set(urls))
    
    print("Found {} font files to download.".format(len(unique_urls)))
    
    for i, url in enumerate(unique_urls):
        ext = url.split('.')[-1]
        filename = "font_{}.{}".format(i, ext)
        filepath = os.path.join(font_folder, filename)
        
        if not os.path.exists(filepath):
            download_file(url, filepath)
        
        css_content = css_content.replace(url, "../fonts/{}".format(filename))
    
    css_path = os.path.join(base_dir, "css", "fonts.css")
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css_content)
    print("Saved local fonts CSS to {}".format(css_path))
    print("Done!")

if __name__ == "__main__":
    main()
