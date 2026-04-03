import os
import json
from urllib.parse import quote
from PIL import Image
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC
from io import BytesIO

BASE_DIR = "/Users/miti/Music/deemixMusic/ipod"
BASE_URL = "https://music.miti.wtf"
THUMB_DIR = "thumbnail"  # base folder for thumbnails
os.makedirs(THUMB_DIR, exist_ok=True)

music_data = {}

for folder in os.listdir(BASE_DIR):
    folder_path = os.path.join(BASE_DIR, folder)

    if os.path.isdir(folder_path):
        songs = []

        # make folder for thumbnails
        safe_folder_name = folder.replace(" ", "_")
        folder_thumb_path = os.path.join(THUMB_DIR, safe_folder_name)
        os.makedirs(folder_thumb_path, exist_ok=True)

        for file in os.listdir(folder_path):
            if file.lower().endswith(".mp3"):
                mp3_path = os.path.join(folder_path, file)
                name_without_ext = os.path.splitext(file)[0]

                # split artist/title
                if " - " in name_without_ext:
                    artist, title = name_without_ext.split(" - ", 1)
                else:
                    artist = "Unknown"
                    title = name_without_ext

                # default thumbnail in case no embedded art
                thumbnail_url = f"{BASE_URL}/default_thumb.jpg"

                # try to extract embedded album art
                audio = MP3(mp3_path, ID3=ID3)
                if audio.tags:
                    for tag in audio.tags.values():
                        if isinstance(tag, APIC):
                            image_data = tag.data
                            image = Image.open(BytesIO(image_data))
                            image.thumbnail((200, 200))  # resize

                            # save thumbnail
                            safe_file_name = quote(name_without_ext.replace(" ", "_")) + ".jpg"
                            thumb_file_path = os.path.join(folder_thumb_path, safe_file_name)
                            image.save(thumb_file_path, format="JPEG")
                            thumbnail_url = f"{BASE_URL}/{THUMB_DIR}/{quote(safe_folder_name)}/{safe_file_name}"
                            break  # use first image per song

                song = {
                    "artist": artist,
                    "title": title,
                    "file": file,
                    "url": f"{BASE_URL}/{quote(folder)}/{quote(file)}",
                    "thumbnail": thumbnail_url
                }

                songs.append(song)

        songs.sort(key=lambda x: (x["artist"], x["title"]))
        music_data[folder] = songs

# write JSON
with open("music.json", "w", encoding="utf-8") as f:
    json.dump(music_data, f, indent=2, ensure_ascii=False)

print("✅ music.json generated with thumbnails for every song!")