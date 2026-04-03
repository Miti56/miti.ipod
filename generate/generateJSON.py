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
THUMB_DIR = "thumbnail"  # folder to store thumbnails
os.makedirs(THUMB_DIR, exist_ok=True)

def sanitize_filename(name):
    """Replace characters illegal in filenames with underscore"""
    return re.sub(r'[\\/*?:"<>|]', "_", name)

music_data = {}

for folder in os.listdir(BASE_DIR):
    folder_path = os.path.join(BASE_DIR, folder)

    if os.path.isdir(folder_path):
        songs = []

        # make folder for thumbnails
        safe_folder_name = sanitize_filename(folder.replace(" ", "_"))
        folder_thumb_path = os.path.join(THUMB_DIR, safe_folder_name)
        os.makedirs(folder_thumb_path, exist_ok=True)

        for file in os.listdir(folder_path):
            if not file.lower().endswith(".mp3"):
                continue

            mp3_path = os.path.join(folder_path, file)
            audio = MP3(mp3_path, ID3=ID3)

            # default values
            artist = "Unknown Artist"
            title = os.path.splitext(file)[0]
            album = folder
            track = None
            year = None
            thumbnail_url = f"{BASE_URL}/default_thumb.jpg"

            # read ID3 tags
            if audio.tags:
                artist_tag = audio.tags.get("TPE1")
                title_tag = audio.tags.get("TIT2")
                album_tag = audio.tags.get("TALB")
                track_tag = audio.tags.get("TRCK")
                year_tag = audio.tags.get("TDRC")

                if artist_tag:
                    artist = str(artist_tag)
                if title_tag:
                    title = str(title_tag)
                if album_tag:
                    album = str(album_tag)
                if track_tag:
                    track = str(track_tag)
                if year_tag:
                    year = str(year_tag)

                # extract embedded album art
                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        image_data = tag.data
                        image = Image.open(BytesIO(image_data))
                        image.thumbnail((200, 200))

                        # safe local filename
                        safe_file_name_local = sanitize_filename(title) + ".jpg"
                        thumb_file_path = os.path.join(folder_thumb_path, safe_file_name_local)
                        image.save(thumb_file_path, format="JPEG")

                        # URL for JSON
                        safe_file_name_url = quote(title) + ".jpg"
                        thumbnail_url = f"{BASE_URL}/{THUMB_DIR}/{quote(safe_folder_name)}/{safe_file_name_url}"
                        break  # only first image per song

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

        # sort by artist -> album -> track
        def song_sort_key(s):
            t = s["track"]
            try:
                t_num = int(t.split("/")[0]) if t else 0
            except:
                t_num = 0
            return (s["artist"], s["album"], t_num)

        songs.sort(key=song_sort_key)
        music_data[folder] = songs

# write JSON
with open("music.json", "w", encoding="utf-8") as f:
    json.dump(music_data, f, indent=2, ensure_ascii=False)

print("✅ music.json generated with full metadata and safe thumbnails!")