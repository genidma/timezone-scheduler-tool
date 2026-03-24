# Timezone Scheduler Tool

An interactive web-based tool that helps event organizers visualize timezone scheduling tradeoffs.

## Features

- Select speakers from different regions (North America, Europe, Asia)
- Choose an event time
- Real-time feedback on speaker availability, audience size by region, and attendance quality
- Experience the constraint that optimizing for one region degrades another
- Visual heatmap showing audience engagement by time slot and region

## Goal

Find the 'least bad' compromise time that balances international speaker access with domestic and international audience reach.

## How to Run

1. Start a local HTTP server in the project directory:
   ```
   python -m http.server 8000
   ```

2. Open http://localhost:8000 in your browser.

## Technologies

- HTML5
- CSS3
- JavaScript (ES6)
- D3.js for data visualization