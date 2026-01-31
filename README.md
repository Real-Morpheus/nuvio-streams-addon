# Nuvio Streams Addon

A high-performance Stremio addon providing aggregated streams with proxy support.

## Features

- **Multi-Provider Support**: Aggregates streams from various sources (VidLink, NetMirror, etc.).
- **Smart Proxying**: Built-in proxy to handle geo-blocking and header manipulation.
- **Admin Dashboard**: Web-based interface to manage configurations and view status.
- **Secure**: Basic Auth and Session-based authentication for administration.
- **Dockerized**: Easy deployment using Docker and Caddy for automatic SSL.

## Quick Start

1.  **Clone the repository**.
2.  **Configure Environment**:
    ```bash
    cp .env.example .env
    # Edit .env with your domain and password
    ```
3.  **Run with Docker**:
    ```bash
    docker-compose up -d --build
    ```
4.  **Access**:
    - Addon Manifest: `https://your-domain.com/manifest.json`
    - Admin Panel: `https://your-domain.com/dashboard`

## Deployment Guide

For a detailed step-by-step guide on setting up a VPS and Domain, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
