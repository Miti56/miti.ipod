import os
import json
from urllib.parse import quote
from PIL import Image
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TALB, TPE1, TRCK, TDRC
from io import BytesIO
import re

BASE_DIR = "/Users/miti/Music/deemixMusic/ipod"
BASE_URL = "https://music.miti.wtf"
THUMB_DIR = "thumbnail"
os.makedirs(THUMB_DIR, exist_ok=True)

def sanitize_filename(name):
    """Replace characters illegal in filenames with underscore"""
    # Added ? to the regex to match your 'Que Dirá?' example
    return re.sub(r'[\\/*?:"<>|]', "_", name)

music_data = {}

for folder in os.listdir(BASE_DIR):
    folder_path = os.path.join(BASE_DIR, folder)

    if os.path.isdir(folder_path):
        songs = []
        safe_folder_name = sanitize_filename(folder.replace(" ", "_"))
        folder_thumb_path = os.path.join(THUMB_DIR, safe_folder_name)
        os.makedirs(folder_thumb_path, exist_ok=True)

        for file in os.listdir(folder_path):
            if not file.lower().endswith(".mp3"):
                continue

            mp3_path = os.path.join(folder_path, file)
            audio = MP3(mp3_path, ID3=ID3)

            artist = "Unknown Artist"
            title = os.path.splitext(file)[0]
            album = folder
            track = None
            year = None
            thumbnail_url = f"{BASE_URL}/default_thumb.jpg"

            if audio.tags:
                artist_tag = audio.tags.get("TPE1")
                title_tag = audio.tags.get("TIT2")
                album_tag = audio.tags.get("TALB")
                track_tag = audio.tags.get("TRCK")
                year_tag = audio.tags.get("TDRC")

                if artist_tag:
                    # Replace null-byte separators with ", "
                    artist = str(artist_tag).replace("\u0000", ", ")
                if title_tag:
                    title = str(title_tag)
                if album_tag:
                    album = str(album_tag)
                if track_tag:
                    track = str(track_tag)
                if year_tag:
                    year = str(year_tag)

                # Generate the sanitized name BEFORE the loop to ensure consistency
                safe_thumb_filename = sanitize_filename(title) + ".jpg"

                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        image_data = tag.data
                        image = Image.open(BytesIO(image_data))
                        image.thumbnail((200, 200))

                        # Save using the sanitized name
                        thumb_file_path = os.path.join(folder_thumb_path, safe_thumb_filename)
                        image.save(thumb_file_path, format="JPEG")

                        # URL now uses the EXACT same sanitized filename as the storage
                        thumbnail_url = f"{BASE_URL}/{THUMB_DIR}/{quote(safe_folder_name)}/{quote(safe_thumb_filename)}"
                        break

            song = {
                "artist": artist,
                "title": title,
                "album": album,
                "track": track,
                "year": year,
                "file": file,
                "url": f"{BASE_URL}/{quote(folder)}/{quote(file)}",
                "thumbnail": thumbnail_url
            }

            songs.append(song)

        def song_sort_key(s):
            t = s["track"]
            try:
                t_num = int(t.split("/")[0]) if t else 0
            except:
                t_num = 0
            return (s["artist"], s["album"], t_num)

        songs.sort(key=song_sort_key)
        music_data[folder] = songs

with open("music.json", "w", encoding="utf-8") as f:
    json.dump(music_data, f, indent=2, ensure_ascii=False)

print("✅ music.json updated! Artists cleaned and Thumbnails synced.")