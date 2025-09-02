import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    
    build: {
        outDir: "dist/background",
        emptyOutDir: false,
        rollupOptions: {
            input: {
                background: resolve(__dirname, "src/background/background.js"),
            },
            output: {
                entryFileNames: "[name].js",
            },
        },
    },

    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    
});
