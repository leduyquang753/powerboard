<script>
import IconCloseRounded from "~icons/material-symbols/close-rounded";
import IconFileExportRounded from "~icons/material-symbols/file-export-rounded";
import IconFolderOpenRounded from "~icons/material-symbols/folder-open-rounded";
import IconMenu from "~icons/material-symbols/menu";
import IconSaveRounded from "~icons/material-symbols/save-rounded";
import IconSettingsRounded from "~icons/material-symbols/settings-rounded";

import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

const {
	"class": classes,
	onOpenWhiteboard: openWhiteboardCallback,
	onSaveWhiteboard: saveWhiteboardCallback,
	onExportWhiteboard: exportWhiteboardCallback
} = $props();

let shouldPlayAnimation = $state(false);
let expanded = $state(false);

const menuContentTabIndex = $derived(expanded ? 0 : -1);

function expandMenu() {
	expanded = true;
	shouldPlayAnimation = true;
}

function collapseMenu() {
	expanded = false;
}

function onOpenWhiteboard() {
	openWhiteboardCallback();
	collapseMenu();
}

function onSaveWhiteboard() {
	saveWhiteboardCallback();
	collapseMenu();
}

function onExportWhiteboard() {
	exportWhiteboardCallback();
	collapseMenu();
}
</script>

<style>
.menu {
	position: absolute;
	top: 1rem;
	left: 1rem;
	width: 4rem;
	height: 4rem;
	border-radius: 2rem;
	overflow: hidden;
	background-color: var(--controlBackground);
	box-shadow: 0 0 8px rgb(0 0 0 / 50%);
	transform-origin: top left;
	user-select: none;
	z-index: 1;
}

.menu:not(.expandedMenu):hover {
	background-color: var(--controlBackgroundHover);
}

.menu.shouldPlayAnimation:not(.expandedMenu) {
	animation: 0.8s shrink;
}

.expandedMenu {
	width: min(calc(100dvw - 2rem), 40rem);
	height: calc(100dvh - 2rem);
	animation: 0.8s expand, 0.4s disableMenuInteractionWhenExpanding;
}

.menuButtonContainer {
	position: absolute;
	right: 0;
	top: 0;
	width: 4rem;
	height: 4rem;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	font-size: 1.5rem;
	transition: opacity 0.5s linear(0, 0, 1);
}

.expandedMenu > .menuButtonContainer {
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.05s;
}

.closeButtonContainer {
	position: absolute;
	right: 1rem;
	top: 1rem;
	width: 4rem;
	height: 4rem;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	border-radius: 2rem;
	font-size: 1.5em;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.1s;
}

.closeButtonContainer:hover {
	background-color: var(--controlBackgroundHover);
}

.expandedMenu > .closeButtonContainer {
	opacity: 1;
	pointer-events: auto;
	transition: opacity 0.5s linear(0, 0, 1);
}

.menuButtonContainer, .closeButtonContainer {
	border-radius: 2rem;
	cursor: pointer;
}

@keyframes expand {
	from {
		width: 4rem;
		height: 4rem;
		animation-timing-function: linear(
			0,
			0.0039 0.87%,
			0.0194,
			0.0442 3.18%,
			0.085 4.63%,
			0.1641 6.94%,
			0.4648 15.04%,
			0.5663 18.22%,
			0.6458 21.11%,
			0.7195,
			0.7798 27.47%,
			0.8323 30.94%,
			0.8762 34.7%,
			0.8952 36.72%,
			0.9135,
			0.9288,
			0.9415 43.66%,
			0.9533,
			0.9627 48.87%,
			0.9718,
			0.9787 55.23%,
			0.9886 62.17%,
			0.9948 70.84%,
			0.9982 82.41%,
			0.9997 99.76%
		);
	}

	to {
		width: min(calc(100dvw - 2rem), 40rem);
		height: calc(100dvh - 2rem);
	}
}

@keyframes disableMenuInteractionWhenExpanding {
	from {
		pointer-events: none;
	}

	to {
		pointer-events: none;
	}
}

@keyframes shrink {
	0% {
		width: min(calc(100dvw - 2rem), 40rem);
		height: calc(100dvh - 2rem);
		transform: scale(1, 1);
		pointer-events: none;
		animation-timing-function: linear(
			0,
			0.0018,
			0.0069 2.65%,
			0.0257,
			0.054 7.94%,
			0.0995 11.27%,
			0.188 16.56%,
			0.5285 35.10%,
			0.6333,
			0.7229,
			0.797,
			0.8563,
			0.9024 68.2%,
			0.9403,
			0.9671 82.78%,
			0.9866 90.72%,
			1 100%
		);
	}

	44% {
		width: 4rem;
		height: 4rem;
		transform: scale(1, 1);
		animation-timing-function: linear(0, 0.7826 39%, 1 100%);
	}

	55% {
		transform: scale(0.9, 0.9);
		animation-timing-function: linear(0, 0.8 49%, 1 100%);
	}

	100% {
		transform: scale(1, 1);
		pointer-events: none;
	}
}

.menuContents {
	width: min(calc(100dvw - 2rem), 40rem);
	height: calc(100dvh - 2rem);
	opacity: 0;
	transition: opacity 0.2s;
}

.menu:not(.expandedMenu) > .menuContents {
	pointer-events: none;
}

.expandedMenu > .menuContents {
	opacity: 1;
	transition: opacity 0.5s;
}

.menuTitle {
	padding: 1.5rem 2rem;
	font-weight: bold;
	font-size: 2rem;
}

.menuEntry {
	width: 100%;
	padding: 1.5rem 2rem;
	display: flex;
	flex-direction: row;
	align-items: center;
	font-size: 1.25rem;
	cursor: pointer;
}

.menuEntry:hover {
	background-color: var(--controlBackgroundHover);
}

.menuEntry > :first-child {
	margin-right: 1rem;
}

.menuEntry > :last-child {
	flex: 1;
}

.menuEntry :global(svg) {
	display: block;
}
</style>

<div class={["menu", {expandedMenu: expanded, shouldPlayAnimation}, classes]}>
	<div
		class=menuButtonContainer role=button tabindex={expanded ? -1 : 0} aria-label=Menu
		onclick={expandMenu} onkeydown={event => { activateButtonFromKeyboard(event, expandMenu); }}
	>
		<IconMenu/>
	</div>
	<div
		class=closeButtonContainer role=button tabindex={menuContentTabIndex} aria-label=Close
		onclick={collapseMenu} onkeydown={event => { activateButtonFromKeyboard(event, collapseMenu); }}
	>
		<IconCloseRounded/>
	</div>
	<div class=menuContents>
		<div class=menuTitle>PowerBoard</div>
		<div
			class=menuEntry role=button tabindex={menuContentTabIndex}
			onclick={onOpenWhiteboard} onkeydown={event => { activateButtonFromKeyboard(event, onOpenWhiteboard); }}
		>
			<div><IconFolderOpenRounded/></div>
			<div>Open whiteboard</div>
		</div>
		<div
			class=menuEntry role=button tabindex={menuContentTabIndex}
			onclick={onSaveWhiteboard} onkeydown={event => { activateButtonFromKeyboard(event, onSaveWhiteboard); }}
		>
			<div><IconSaveRounded/></div>
			<div>Save whiteboard</div>
		</div>
		<div
			class=menuEntry role=button tabindex={menuContentTabIndex}
			onclick={onExportWhiteboard} onkeydown={event => { activateButtonFromKeyboard(event, onExportWhiteboard); }}
		>
			<div><IconFileExportRounded/></div>
			<div>Export whiteboard as SVG</div>
		</div>
		<!--div class=menuEntry role=button tabindex={menuContentTabIndex}>
			<div><IconSettingsRounded/></div>
			<div>Settings</div>
		</div-->
	</div>
</div>