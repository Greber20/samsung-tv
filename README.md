# Graden & Annyka — our TV home screen

A home screen for the 75" Samsung Q7F: our photos full-screen, a greeting and the time,
an app row (Netflix, Prime Video, Disney+, YouTube, Annyka's album, Settings, Samsung Home),
and Annyka's Suno album as a surprise when the TV sits idle.

## How it behaves

- **Dashboard:** photo in the background, app row along the bottom. Left / Right to move, OK to open.
- **Idle for 30 seconds:** the app row fades away, the photo fills the screen, and a shuffled
  song from the album starts with a small card showing its cover, title and progress.
  Any button brings the app row back; the music keeps playing.
- **Annyka's Album tile:** opens the whole album. Pick any song, **Shuffle all**, or **Stop music**.
  Back closes it.
- **Opening Netflix / Prime / Disney+ / YouTube** stops our music first.
- **Samsung Home** steps back to Samsung's own home screen. **Settings** opens the TV settings.
- Remote play/pause starts or stops the music; next-track skips.

## Two ways to run it

**As a TV app (the real home screen).** Installed on the TV through Samsung's Developer Mode.
This is the only way the app tiles can open Netflix and the rest, because web pages can't
open TV apps. The app downloads the latest song and photo lists from the GitHub Pages site.

**In the TV's Internet app (preview).** Everything works except the app tiles, which just say
they need the TV app. Good for checking photos and music.

## GitHub Pages and the daily song refresh

The workflow in `.github/workflows/deploy.yml` runs on every push and every morning around
4 AM Mountain. It pulls the current song list from Annyka's Suno playlist into `songs.js`,
rebuilds `photos.js` from the `photos/` folder, and publishes the site. On a free GitHub plan,
Pages needs a **public** repository, so these photos are viewable by anyone with the link.

Turn it on once: **Settings → Pages → Source: GitHub Actions**, then **Actions → Refresh songs
and deploy → Run workflow**.

## Adding things later

- **New songs:** add them to Annyka's playlist on Suno. They show up the next morning, and
  new songs play first.
- **New photos:** add **horizontal** photos to `photos/` (about 2000–3000 px wide).
  `photos-portrait/` holds the vertical ones; it isn't uploaded.

## How the music works

Suno encrypts its audio files, so songs play through Suno's own embed player (the small player
at the foot of the now-playing card), straight from suno.com. That player doesn't report its
progress or when a song ends, so the card's progress bar and the move to the next song are
timed from each song's length in Suno's playlist info.
