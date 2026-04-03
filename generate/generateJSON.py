import os
import json
from urllib.parse import quote

BASE_DIR = "/Users/miti/Music/deemixMusic/ipod"
BASE_URL = "https://pub-930d78549e564d628184df9a65b61e73.r2.dev"

music_data = {}

for folder in os.listdir(BASE_DIR):
    folder_path = os.path.join(BASE_DIR, folder)

    if os.path.isdir(folder_path):
        songs = []

        for file in os.listdir(folder_path):
            if file.lower().endswith(".mp3"):
                name_without_ext = os.path.splitext(file)[0]

                # Try to split "Artist - Title"
                if " - " in name_without_ext:
                    artist, title = name_without_ext.split(" - ", 1)
                else:
                    artist = "Unknown"
                    title = name_without_ext

                song = {
                    "artist": artist,
                    "title": title,
                    "file": file,
                    "url": f"{BASE_URL}/{quote(folder)}/{quote(file)}"
                }

                songs.append(song)

        songs.sort(key=lambda x: (x["artist"], x["title"]))
        music_data[folder] = songs

with open("music.json", "w", encoding="utf-8") as f:
    json.dump(music_data, f, indent=2, ensure_ascii=False)

print("✅ music.json generated!")