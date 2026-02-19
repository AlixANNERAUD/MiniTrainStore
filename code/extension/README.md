# Leboncoin Scraper Extension

A browser extension built with WXT and Vue 3 to automatically scrape and track listings from leboncoin.fr profiles.

## Features

- 🤖 **Automatic Scraping**: Automatically extracts listings when you visit a leboncoin.fr profile page
- 👤 **Profile-Based Storage**: Saves listings separately for each profile
- 💾 **Local Storage**: All data is stored in browser's local storage
- 📊 **View & Filter**: Browse saved listings with sorting and filtering options
- 🎨 **Modern UI**: Built with Vue 3 and Tailwind CSS

## How to Use

1. **Install the extension** in your browser
2. **Navigate** to any leboncoin.fr profile page (e.g., `https://www.leboncoin.fr/profile/USERNAME`)
3. **Wait a moment** - the extension will automatically scrape the listings
4. **View** your saved listings by clicking the extension icon in your browser toolbar

The scraping happens automatically - no button to click!

## Features in the Popup

- **Profile Selector**: Switch between different scraped profiles
- **Sort** listings by date or price
- **Filter** by status (Active, Sold, Removed)
- **Refresh** to reload profiles
- **Delete** individual profiles or all data
- **Click** any listing to open it in a new tab
- **Last Scraped** time displayed for each profile

## Development

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

## Architecture

- **Content Script**: Detects profile pages and automatically scrapes listings
- **Background Script**: Manages storage and merges data per profile
- **Popup**: Vue 3 interface to view and manage scraped data

## Tech Stack

- **WXT**: Modern web extension framework
- **Vue 3**: Progressive JavaScript framework
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type-safe JavaScript

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
