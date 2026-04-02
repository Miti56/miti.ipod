# 🎧 Found: One iPod Classic

> Do you remember the feeling of holding a thousand songs in your pocket?
>
> There is a very specific kind of magic in finding an abandoned iPod. Maybe it was at the bottom of a thrift store bin, or tucked away in the back of a drawer. You pick it up, feeling the cold, scratched metal on the back and the smooth plastic on the front. You press the center button, hoping the battery holds just enough of a charge to wake up.
>
> It flickers to life. A glowing screen.
>
> You run your thumb over the wheel—*click, click, click*—and suddenly, you're diving into a time capsule. You're exploring a stranger's soul through their perfectly curated playlists, their teenage angst albums, and their summer road trip mixes.

This project is a love letter to that exact feeling. It is a digital recreation of a lost artifact, designed to bring back the tactile joy of scrolling through music, but with a modern twist.

---

## ✨ The Artifact

When you boot this up, it feels just like the real thing. But as you dig through the menus, you'll realize this isn't just a time capsule stuck in 2006.

* **The Infinite Library:** It looks and feels like it only holds 30GB, but it secretly connects to modern streaming platforms. You get the nostalgia of the classic interface with the endless catalog of today.
* **The Click Wheel:** The navigation is built around that iconic, satisfying scrolling motion. It’s meant to feel deliberate and grounded.
* **Hidden Memories:** Just like any good iPod found in the wild, there's more than just music on here. Dig deep enough into the Extras menu, and you might just find a classic game of Brick waiting for you.
* **Swap the Shell:** Found a silver one? You can easily swap the "casing" to a sleek black or a special edition theme.

---

## ⚡ Waking It Up (Installation)

If you want to boot up this found device on your own machine, you'll need to run a quick jump-start sequence.

**What you need in your toolkit:**
* Node.js
* Yarn

**The Boot Sequence:**

```bash
# Install the necessary components
yarn install

# Power on the device
yarn dev
```

Once the screen turns on, head over to **[http://127.0.0.1:3000/ipod](http://127.0.0.1:3000/ipod)** to start exploring. *(Note: Make sure to use `127.0.0.1` rather than `localhost` to keep the modern streaming connections happy!)*

---

## 🔌 Reconnecting the Wires (Configuration)

To give the iPod its modern streaming abilities, you'll need to hook it up to your own streaming developer accounts. Create a `.env.local` file in your project root and drop in your credentials so the device knows who to play music for:

```bash
# Your Spotify Configuration
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Your Apple Music Configuration  
APPLE_DEVELOPER_TOKEN=your_token_here
```

---

## 🤝 Leave Your Mark

When you find an old device, sometimes you want to carve your own initials into the back. If you want to add your own Easter eggs, new games, or custom shells to this project, pull requests are always welcome. Let's keep building this time machine together.

***

*Put your headphones on, turn up the volume, and get lost in the music.*