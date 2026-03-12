export function activateButtonFromKeyboard(event, onActivate) {
	if (event.key === " " || event.key === "Enter") onActivate();
}