# Nuvio Streams Deployment Guide

This guide will walk you through setting up the Nuvio Streams Addon on a fresh VPS (Virtual Private Server) with a custom domain.

## Prerequisites

1.  **A VPS**: recommended providers include DigitalOcean, Hetzner, Vultr, or Linode.
    *   **OS**: Ubuntu 22.04 LTS (Recommended) or Debian 11/12.
    *   **Specs**: 1GB RAM / 1 vCPU is sufficient for light usage.
2.  **A Domain Name**: You need a domain (e.g., `example.com`) or subdomain (e.g., `addon.example.com`).
3.  **SSH Client**: Terminal (Mac/Linux) or PowerShell/PuTTY (Windows).

---

## Step 1: DNS Configuration

Before touching the server, configure your domain to point to your VPS IP address.

1.  Log in to your Domain Registrar (Namecheap, GoDaddy, Cloudflare, etc.).
2.  Go to **DNS Management**.
3.  Add an **A Record**:
    *   **Name/Host**: `@` (for root domain) or `addon` (for subdomain like `addon.yourdomain.com`).
    *   **Value/IP**: Your VPS IP Address (e.g., `46.38.xxx.xxx`).
    *   **TTL**: Automatic or 1 min.
4.  Save changes. DNS propagation may take a few minutes to hours.

---

## Step 2: Prepare the VPS

Connect to your VPS via SSH:
```bash
ssh root@your_vps_ip
# Enter password when prompted
```

### 2.1 Update System
```bash
apt update && apt upgrade -y
```

### 2.2 Install Docker & Docker Compose
The easiest way to install Docker on Ubuntu/Debian:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Verify installation:
```bash
docker --version
docker compose version
```

---

## Step 3: Deploy the Addon

### 3.1 Upload the Project
You can either clone your GitHub repository (if you pushed it) or upload files via SFTP/SCP.

**Option A: Git (Recommended)**
1.  Install Git: `apt install git -y`
2.  Clone your repo:
    ```bash
    git clone https://github.com/yourusername/your-repo-name.git nuvio-addon
    cd nuvio-addon
    ```

**Option B: Manual Upload**
Use an SFTP client (like FileZilla) or `scp` to upload the project folder to `/root/nuvio-addon`.

### 3.2 Configure Environment
1.  Copy the example configuration:
    ```bash
    cp .env.example .env
    ```
2.  Edit the `.env` file:
    ```bash
    nano .env
    ```
3.  Update the following values:
    *   `ADMIN_PASS`: Set a strong password.
    *   `MEDIAFLOW_PUBLIC_URL`: Set to `https://your-domain.com`.
    *   `DOMAIN_NAME`: Set to `your-domain.com` (Used by Caddy for SSL).
4.  Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 3.3 Start the Application
Run the container using Docker Compose:
```bash
docker compose up -d --build
```
*   `up`: Start containers.
*   `-d`: Detached mode (run in background).
*   `--build`: Rebuild images if code changed.

### 3.4 Verify Deployment
1.  Check running containers:
    ```bash
    docker compose ps
    ```
    You should see `nuvio-stack-app-1` (or similar) and `caddy`.
2.  Check logs if something seems wrong:
    ```bash
    docker compose logs -f app
    ```

---

## Step 4: Access the Addon

1.  **Test in Browser**: Visit `https://your-domain.com`. You should see the login page or welcome page.
2.  **Login**: Go to `https://your-domain.com/dashboard` (or click Login). Use `admin` and the password you set in `.env`.
3.  **Add to Stremio**:
    *   Copy your manifest URL: `https://your-domain.com/manifest.json`
    *   Paste it into the Stremio search bar or Addon install field.

---

## Troubleshooting

*   **502 Bad Gateway**: The app isn't running or Caddy can't reach it. Check `docker compose logs caddy`.
*   **SSL Errors**: Ensure ports 80 and 443 are open on your VPS firewall.
    ```bash
    ufw allow 80
    ufw allow 443
    ```
*   **Streams Not Playing**: Check `docker compose logs app` to see if the proxy is throwing errors. Ensure `MEDIAFLOW_PUBLIC_URL` matches your actual domain in `.env`.
