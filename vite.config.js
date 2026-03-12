import {sveltekit} from "@sveltejs/kit/vite";
import Icons from "unplugin-icons/vite";
import {defineConfig} from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({plugins: [
	sveltekit(),
	Icons({compiler: "svelte"}),
	devtoolsJson()
]});