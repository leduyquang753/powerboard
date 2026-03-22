export const ssr = false;

export function load() {
	let config = null;
	let configString = window.localStorage.getItem("config");
	if (configString !== null) try {
		config = JSON.parse(configString);
	} catch (e) {}
	return {config};
}