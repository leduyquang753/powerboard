import adapter from "@sveltejs/adapter-static";

const config = {
	kit: {
		adapter: adapter(),
		alias: {
			"$controls": "src/lib/controls"
		}
	}
};
export default config;