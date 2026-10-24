<h1 align="center">music-api</h1>
<img src="https://example.com" alt="Alt Text" width="500">
<p align="center">
    A self-hosted music api that runs quite smoothly.
</p>

>[!IMPORTANT]
>This project is inspired by [x8rr/music](https://github.com/x8rr/music) what's changed is the project is now written in JavaScript with CSS elements.

## Features
* YouTube Music Searching
* Tidal Searching
* SoundCloud & YouTube Music playback
* Artist vewing
* Slick Liquid Glass UI

## Deploying
You need **Node.js 22 or newer**.

```sh
# 1. Grab the dependencies
npm install

# 2. Download yt-dlp into ./bin, which does the actual audio fetching
npm run setup

# 3. Run the server
npm run dev
```

And the open `https://localhost:2010` and you're done!

## Credits

* [yaanscoat](https://github.com/yaanscoat) - Creator
* [x8rr](https://github.com/x8rr) - API Inspiration
* beery-tomato - Manager
