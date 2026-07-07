# AOSubsonic

AOSubsonic is a modern, responsive web client for Subsonic-compatible music servers (such as Navidrome). It features a beautiful, dynamic UI with both a dedicated desktop layout and a touch-optimized mobile web app experience.

## Features

- **Subsonic API Integration**: Connects seamlessly to any Subsonic-compatible server (tested thoroughly with Navidrome).
- **Responsive Design**: Automatically switches between a full-featured desktop interface and a dedicated mobile UI based on screen size.
- **Library Browsing**: Browse your music library by Artists, Albums, and Tracks.
- **Playlists**: Full support for viewing, creating, deleting, and modifying playlists.
- **Advanced Search**: Fast, debounced search for artists, albums, and songs.
- **Synchronized Lyrics**: Built-in lyrics viewer for supported tracks.
- **AI Playlists**: Generate custom playlists using AI prompts.
- **Gapless-like Playback Engine**: Robust queue management, background playback, and progress tracking using Zustand state management.
- **Dynamic Theming**: Extracts dominant colors from album art to dynamically theme the player and UI elements.

## Tech Stack

- **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [React Query](https://tanstack.com/query/latest)
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/)

## Getting Started

### Prerequisites

- Node.js 20+ (for local development)
- Docker (for containerized deployment)
- A Subsonic-compatible server (e.g., Navidrome)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/xhatsu/AOSubsonic.git
   cd AOSubsonic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite. You will be prompted to enter your Subsonic server URL, username, and password.

### Docker Deployment

AOSubsonic can be easily deployed using Docker. A multi-stage Dockerfile is provided to build an optimized Nginx image.

**Using Docker CLI:**
```bash
# Pull the latest image
docker pull xhatsu101/aosubsonic:1.4

# Run the container
docker run -p 8080:80 xhatsu101/aosubsonic:1.4
```

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to open an issue or submit a pull request.
