import adapter from "@sveltejs/adapter-static";
import {sveltekit} from "@sveltejs/kit/vite";
import {FileSystemIconLoader} from "unplugin-icons/loaders";
import Icons from "unplugin-icons/vite";
import {defineConfig} from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter()
		}),
		Icons({
			compiler: "svelte",
			customCollections: {
				"powerboard-icons": FileSystemIconLoader("./assets/powerboard-icons")
			}
		}),
		devtoolsJson()
	],
	test: {
		include: ["./tests/**/*.test.js"]
	}
});