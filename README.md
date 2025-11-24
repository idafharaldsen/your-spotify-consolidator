# Your Spotify Consolidator 🧹🔄📊

A tool to process, consolidate, and visualize your complete Spotify listening history. Transform your raw Spotify Extended Streaming History data into beautiful statistics and insights through a modern web interface.

## Features

- 📊 **Complete History Processing**: Process your entire Spotify listening history from exported data
- 🧹 **Smart Consolidation**: Automatically consolidates duplicate songs, albums, and artists
- 📈 **Beautiful Statistics**: View yearly listening trends, top songs, albums, and artists
- 🌐 **Web Dashboard**: Modern Next.js web app deployed on Vercel
- 🔄 **Automatic Syncing**: GitHub Actions automatically fetches recent plays every 2 hours to keep your data up to date
- 🎵 **Rich Metadata**: Enriches data with album art, artist images, and track information via Spotify API

## Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn package manager
- Your Spotify Extended Streaming History data (see [Getting Your Data](#getting-your-spotify-data))

## Getting Your Spotify Data

1. Go to [Spotify's Privacy Settings](https://www.spotify.com/account/privacy/)
2. Scroll down to "Download your data"
3. Click "Request data" and select "Extended streaming history"
4. Wait for Spotify to prepare your data (this can take a few days)
5. Download the ZIP file when ready
6. Extract the JSON files - you'll find files named `Streaming_History_Audio_*.json`

## Installation

1. Fork this repository:
```bash
git clone https://github.com/YOUR_USERNAME/your-spotify-consolidator.git
cd your-spotify-consolidator
```

2. Install dependencies:
```bash
npm install
cd web-app && npm install && cd ..
```

3. Set up Spotify API credentials (required for automatic syncing and metadata enrichment):
   - Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Get your `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
   - Set up a redirect URI and get a refresh token (see `scripts/setup-spotify-auth.ts`)
   - Add to `.env`:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REFRESH_TOKEN=your_refresh_token
   ```

4. (Optional) Set up Vercel Blob Storage for cloud file storage:
   - Install Vercel CLI: `npm i -g vercel`
   - Link your project: `vercel link`
   - Get your Blob Store token from [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables
   - Add `BLOB_READ_WRITE_TOKEN` to your `.env` file (or set it in Vercel Dashboard for production)
   - To disable uploads, set `UPLOAD_TO_VERCEL_BLOB=false` in your `.env`

## Usage

### Step 1: Add Your Spotify History Data

Place your extracted `Streaming_History_Audio_*.json` files into the `data/spotify-history/` folder:

```
data/
  spotify-history/
    Streaming_History_Audio_2009-2013_0.json
    Streaming_History_Audio_2013-2014_1.json
    Streaming_History_Audio_2014_2.json
    ... (all your history files)
```

### Step 2: Merge Streaming History

Merge all your streaming history files into a single consolidated file:

```bash
npm run merge-streaming-history
```

This will:
- Read all `Streaming_History_Audio_*.json` files from `data/spotify-history/`
- Consolidate entries by song (combining play counts and listening time)
- Save merged data to `data/merged-streaming-history/merged-streaming-history-{timestamp}.json`
- Display summary statistics

### Step 3: Generate Cleaned Files

Generate cleaned and consolidated data files for the web app:

```bash
npm run generate-cleaned-files
```

This will:
- Load the merged streaming history
- Generate cleaned songs, albums, artists, and albums-with-songs files
- Calculate detailed statistics (yearly listening time, top items, hourly distribution)
- Enrich with Spotify API metadata (if credentials are configured)
- Save files to `data/cleaned-data/`
- Optionally upload to Vercel Blob Storage

### Step 4: View Your Statistics

#### Local Development

Start the web app locally:

```bash
npm run web:dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

#### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Vercel will automatically detect the Next.js app and deploy it
4. Your statistics will be available at your Vercel URL

### Step 5: Set Up Automatic Syncing (Optional)

GitHub Actions will automatically fetch your recent Spotify plays every 2 hours and keep your data up to date. To enable this:

1. **Set up GitHub Secrets**:
   - Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"** and add these secrets:
   
   | Secret Name | Value | Description |
   |-------------|-------|-------------|
   | `SPOTIFY_CLIENT_ID` | Your Client ID | From Spotify Developer Dashboard |
   | `SPOTIFY_CLIENT_SECRET` | Your Client Secret | From Spotify Developer Dashboard |
   | `SPOTIFY_REFRESH_TOKEN` | Your Refresh Token | From `npm run setup-spotify-auth` |
   | `PERSONAL_ACCESS_TOKEN` | GitHub PAT | Personal Access Token with repo permissions (for pushing updates) |
   | `BLOB_READ_WRITE_TOKEN` | (Optional) | Vercel Blob Storage token |
   | `VERCEL_DEPLOY_HOOK` | (Optional) | Vercel deploy hook URL to trigger deployments |

2. **Enable GitHub Actions**:
   - Go to the **Actions** tab in your repository
   - Click **"Enable Actions"** if prompted
   - The workflow will start running automatically every 2 hours

**What happens automatically:**
- Every 2 hours, GitHub Actions checks for new tracks in your Spotify account
- If new tracks are found, it fetches recent plays, merges them with your existing data, and generates updated cleaned files
- Changes are automatically committed and pushed to your repository
- Optionally triggers a Vercel deployment to update your live site

**Note**: Spotify API credentials are required for automatic syncing to work. Without them, you'll need to manually run the scripts to update your data.

The web app includes:
- **Statistics Dashboard**: Yearly listening trends, hourly distribution, total listening time
- **Top Songs**: Browse your most-played songs with search and filtering
- **Top Albums**: View your favorite albums with play counts
- **Top Artists**: See your most-listened artists
- **Albums with Details**: Explore albums with track-by-track breakdowns

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run merge-streaming-history` | Merge all streaming history files into one consolidated file |
| `npm run generate-cleaned-files` | Generate cleaned songs, albums, artists, and stats files |
| `npm run web:dev` | Start the web app in development mode |
| `npm run web:build` | Build the web app for production |

## Project Structure

```
your-spotify-consolidator/
├── data/
│   ├── spotify-history/          # Place your Streaming_History_Audio_*.json files here
│   ├── merged-streaming-history/ # Generated merged history files
│   └── cleaned-data/             # Generated cleaned files for web app
├── scripts/
│   ├── merge-streaming-history.ts
│   ├── cleaner/
│   │   └── generate-cleaned-files-from-history.ts
│   └── ...
├── web-app/                      # Next.js web application
│   ├── app/
│   │   ├── page.tsx              # Statistics dashboard
│   │   ├── top-songs/
│   │   ├── top-albums/
│   │   ├── top-artists/
│   │   └── api/                  # API routes for data
│   └── components/
└── README.md
```

## Data Files Generated

After running `generate-cleaned-files`, you'll find:

- `cleaned-songs-{timestamp}.json`: Top 500 songs with play counts
- `cleaned-albums-{timestamp}.json`: Top 500 albums with play counts
- `cleaned-artists-{timestamp}.json`: Top 500 artists with play counts
- `cleaned-albums-with-songs-{timestamp}.json`: Top 100 albums with track breakdowns
- `detailed-stats-{timestamp}.json`: Comprehensive statistics including yearly trends

## Configuration

### Environment Variables

| Variable | Description | Required | Used By |
|----------|-------------|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify API client ID | **Yes** (for auto-sync) | Local scripts & GitHub Actions |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret | **Yes** (for auto-sync) | Local scripts & GitHub Actions |
| `SPOTIFY_REFRESH_TOKEN` | Spotify API refresh token | **Yes** (for auto-sync) | Local scripts & GitHub Actions |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage token | No | Local scripts & GitHub Actions |
| `UPLOAD_TO_VERCEL_BLOB` | Enable/disable blob uploads | No (default: `true`) | Local scripts |

**Important Notes**:
- **Spotify credentials are required** for GitHub Actions automatic syncing to work
- Without Spotify credentials, you can still process your historical data, but automatic updates won't work
- Metadata enrichment (album art, artist images) requires Spotify API credentials
- For GitHub Actions, add these as **GitHub Secrets** (not just `.env` file)

## Troubleshooting

### "No Streaming_History_Audio_*.json files found"

- Make sure you've extracted your Spotify data ZIP file
- Place all `Streaming_History_Audio_*.json` files in the `data/spotify-history/` folder
- Check that file names start with `Streaming_History_Audio_` and end with `.json`

### Web app shows "No data available"

- Make sure you've run `npm run generate-cleaned-files` first
- Check that files exist in `data/cleaned-data/`
- Verify the API routes can read the files (check file permissions)

### Metadata enrichment not working

- Verify your Spotify API credentials are set correctly in `.env`
- Check that your refresh token is valid (run `npm run setup-spotify-auth` to set it up)
- The tool will continue without metadata if API calls fail

### GitHub Actions not syncing

- Verify all required GitHub Secrets are set: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, and `PERSONAL_ACCESS_TOKEN`
- Check the Actions tab in your repository to see workflow run logs
- Ensure your refresh token hasn't expired (re-run `npm run setup-spotify-auth` if needed)
- Verify your Personal Access Token has `repo` permissions

## License

MIT
