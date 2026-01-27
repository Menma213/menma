# Menma's Winter World - Cloudflare Pages Deployment

This website is ready to be deployed to Cloudflare Pages.

## Deployment Instructions

1.  **Upload to GitHub:** Create a new GitHub repository and upload the contents of this `website` directory to it.

2.  **Create a Cloudflare Pages Project:**
    *   Log in to your Cloudflare dashboard.
    *   Go to **Workers & Pages**.
    *   Click **Create application** and select the **Pages** tab.
    *   Connect to your GitHub account and select the repository you just created.

3.  **Configure the Build Settings:**
    *   **Framework preset:** Select **None**.
    *   **Build command:** Leave this blank.
    *   **Build output directory:** Set this to `/` (since the repository root is the `website` directory).
    *   Click **Save and Deploy**.

4.  **Configure Environment Variables:**
    *   After your first deployment, go to your project's settings.
    *   Go to **Environment variables**.
    *   Add the following two environment variables:
        *   `DISCORD_CLIENT_ID`: Your Discord application's client ID.
        *   `DISCORD_CLIENT_SECRET`: Your Discord application's client secret.
    *   Redeploy your application for the changes to take effect.

<!-- this will be the comment xd -->
this is what i get: 
2025-12-09T09:11:59.353987Z	Cloning repository...
2025-12-09T09:12:00.286002Z	From https://github.com/RsThunderbird/ShinobiRPG
2025-12-09T09:12:00.286543Z	 * branch            b71b05c88a06d8051e654fc2a71be8ea99330446 -> FETCH_HEAD
2025-12-09T09:12:00.28665Z	
2025-12-09T09:12:00.325967Z	HEAD is now at b71b05c Add files via upload
2025-12-09T09:12:00.326415Z	
2025-12-09T09:12:00.407551Z	
2025-12-09T09:12:00.408023Z	Using v2 root directory strategy
2025-12-09T09:12:00.429192Z	Success: Finished cloning repository files
2025-12-09T09:12:02.16446Z	Checking for configuration in a Wrangler configuration file (BETA)
2025-12-09T09:12:02.165049Z	
2025-12-09T09:12:03.260683Z	No wrangler.toml file found. Continuing.
2025-12-09T09:12:03.26102Z	No build command specified. Skipping build step.
2025-12-09T09:12:03.261768Z	Found Functions directory at /functions. Uploading.
2025-12-09T09:12:03.268261Z	 ⛅️ wrangler 3.101.0
2025-12-09T09:12:03.268514Z	-------------------
2025-12-09T09:12:04.191709Z	
2025-12-09T09:12:04.296703Z	[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mNo routes found when building Functions directory: /opt/buildhome/repo/website/functions[0m
2025-12-09T09:12:04.296991Z	
2025-12-09T09:12:04.297124Z	
2025-12-09T09:12:04.363913Z	🪵  Logs were written to "/root/.config/.wrangler/logs/wrangler-2025-12-09_09-12-03_922.log"
2025-12-09T09:12:04.375728Z	Warning: Wrangler did not find routes when building functions. Skipping.
2025-12-09T09:12:04.376065Z	Found _routes.json in output directory. Uploading.
2025-12-09T09:12:04.387797Z	Validating asset output directory
2025-12-09T09:12:07.196282Z	Deploying your site to Cloudflare's global network...
2025-12-09T09:12:09.308854Z	Uploading... (10/10)
2025-12-09T09:12:09.309914Z	✨ Success! Uploaded 0 files (10 already uploaded) (0.28 sec)
2025-12-09T09:12:09.310224Z	
2025-12-09T09:12:09.59153Z	✨ Upload complete!
2025-12-09T09:12:13.43178Z	Success: Assets published!
2025-12-09T09:12:15.930315Z	Success: Your site was deployed!