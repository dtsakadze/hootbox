# Changelog

## 0.1.0 (2026-10-05)


### Features

* **auth:** extension-gated open sign-up for the hosted edition ([a111658](https://github.com/dtsakadze/hootbox/commit/a111658a895323ee02bf57be8e35fb93682dc8e9))
* auto-load optional ee/ extensions for a future hosted edition ([3216557](https://github.com/dtsakadze/hootbox/commit/321655744805925140561a79412fd632f1069cff))
* **db:** add Postgres schema, client and migrations ([6f19282](https://github.com/dtsakadze/hootbox/commit/6f19282277c52021a4bbe63efc228fd0e6ebc3e8))
* **deploy:** Dockerfile, docker-compose and portable migration runner ([2d5655f](https://github.com/dtsakadze/hootbox/commit/2d5655f0639dc60515fd8f53afcac5fe75da60dc))
* embeddable widget, dashboard widget preview and demo seed script ([f07d965](https://github.com/dtsakadze/hootbox/commit/f07d965702fafac11ddfce55df403454d54a32a2))
* **server:** auth, workspaces, projects, feedback & webhook services with DB-backed tests ([d7cb66a](https://github.com/dtsakadze/hootbox/commit/d7cb66acb1b30e1efe6e0a0d14a9805810b113b9))
* show running version and notify admins about new releases ([8cc9299](https://github.com/dtsakadze/hootbox/commit/8cc9299cea48cac1db41a04de8f9a965e3941db5))
* **web:** inbox, insights, install, settings, team, account, public board & form pages ([0874e86](https://github.com/dtsakadze/hootbox/commit/0874e86cab252e2ad6dd29adead2d6b3256bf83e))
* **web:** server functions, API routes, design system, auth pages and app shell ([d133372](https://github.com/dtsakadze/hootbox/commit/d133372e02d7af53c848605b52437cb6b83fb222))


### Bug Fixes

* deep review — safe notification links, friendly unique conflicts, session purge, admin-only delete, hide webhook URL from members ([3a43050](https://github.com/dtsakadze/hootbox/commit/3a430508cc607e742444406d76a41c79443b7ed8))
* **feedback:** normalise tags in service and support partial email search ([e0eb7e0](https://github.com/dtsakadze/hootbox/commit/e0eb7e0cd0da38b6de4265863f0f3a3dbc74c369))
* ignore extension-injected body attributes during hydration ([9fe3e40](https://github.com/dtsakadze/hootbox/commit/9fe3e40bbccdb6669f61f225108fc9defe3324b6))
* **public:** 404 for unknown boards/forms and keep URLs free of default search params ([96051d6](https://github.com/dtsakadze/hootbox/commit/96051d6f933bc7bfc0a416893011c64c29cc1de8))
* review pass — origin allowlist only governs browsers, block private webhook targets, single-query project access ([3ef56a3](https://github.com/dtsakadze/hootbox/commit/3ef56a3c63a1f910988b2067c7198d5920d9a14a))
* strict embed flag without redirects, safe metadata keys ([31c21e9](https://github.com/dtsakadze/hootbox/commit/31c21e93b6e2007c15a7fd6be3db7acb98356f7a))
* **ui:** vote button sizing, responsive public form fields, clearer weekly delta ([0589a51](https://github.com/dtsakadze/hootbox/commit/0589a513d439f5d62188ca374d4040ca391074f5))
