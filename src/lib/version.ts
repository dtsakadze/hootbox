declare const __APP_VERSION__: string | undefined;

/** The running Hootbox version, baked in at build time from package.json. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
