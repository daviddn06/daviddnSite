# daviddn.dev

David's portfolio site, built with Astro. Run `npm ci` and `npm run dev` to work on it locally.

Deploys are automatic. Every push to main runs the Deploy workflow, which builds the site on GitHub with `npm run build` and sends `dist/` to InterServer through daviddn06/deploy. Each deploy becomes a new release folder under /var/www/daviddn-portfolio/releases, switched in by the `current` symlink that Caddy serves, and it rolls back on its own if the home page check fails. To pause deploys set the Actions variable AUTODEPLOY to `off`. To roll back, open Actions, Deploy, Run workflow and pick rollback.
