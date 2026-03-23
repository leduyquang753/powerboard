<script>
import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

//import Slider from "$controls/Slider.svelte";

import IconChevronLeftRounded from "~icons/material-symbols/chevron-left-rounded";
import IconStarOutlineRounded from "~icons/material-symbols/star-outline-rounded";
import IconStarRounded from "~icons/material-symbols/star-rounded";
import IconEraserModePartial from "~icons/powerboard-icons/eraser-mode-partial";
import IconEraserModeWhole from "~icons/powerboard-icons/eraser-mode-whole";

let {
	eraseWholeStroke = $bindable(),
	eraseSize = $bindable(),
	favoriteEraseSizes = $bindable(),
} = $props();

const currentEraseSizeIsFavorite = $derived(favoriteEraseSizes.includes(eraseSize));
let eraseSizeExpanded = $state(false);

function toggleEraseSizeInput() {
	eraseSizeExpanded = !eraseSizeExpanded;
}

function addEraseSizeToFavorites() {
	let insertIndex = favoriteEraseSizes.length;
	for (let i = 0; i < favoriteEraseSizes.length; ++i) {
		if (favoriteEraseSizes[i] > eraseSize) {
			insertIndex = i;
			break;
		}
	}
	favoriteEraseSizes.splice(insertIndex, 0, eraseSize);
}

function removeEraseSizeFromFavorites() {
	favoriteEraseSizes.splice(favoriteEraseSizes.indexOf(eraseSize), 1);
}
</script>

<style>
.controlGroup {
	position: relative;
	min-height: 0;
	display: flex;
	flex-direction: row;
	align-items: start;
	gap: 0.25rem;
	border-radius: 1.5rem;
	background: var(--controlBackground);
	box-shadow: 0 0 4px rgb(0 0 0 / 50%);
}

.modeControlGroup {
	flex-shrink: 0;
}

.mainColumn {
	display: flex;
	flex-direction: column;
	align-items: start;
	height: 100%;
}

.button {
	cursor: pointer;
}

.button > div {
	min-width: 3rem;
	min-height: 3rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 1.5rem;
}

.button:focus-visible {
	outline: none
}

.button:hover > div {
	background: rgba(0 0 0 / 10%);
}

.button:focus-visible > div {
	outline: 1px solid black;
}

.collapseIcon, .favoriteButton, .modeButton {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	font-size: 1.5rem;
}

.activeFavoriteButton {
	color: #0078D4;
}

.separator {
	align-self: center;
	flex-shrink: 0;
	width: 2rem;
	height: 1px;
	margin: 1px 0;
	background: gray;
}

.favorites {
	border-radius: 0 0 1.5rem 1.5rem;
	overflow: hidden;
	overflow-y: auto;
	scrollbar-width: thin;
	scrollbar-color: transparent transparent;
}

.favorites:hover {
	scrollbar-color: gray transparent;
}

.modeButton, .eraseSizeDisplay {
	min-width: 3rem;
	min-height: 3rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 1.5rem;
}

.activeModeButton, .activeFavoriteEraseSizeDisplay {
	background: radial-gradient(
		rgb(from var(--activeAccentColor) r g b / 40%),
		rgb(from var(--activeAccentColor) r g b / 0%) 1.5rem
	);
}

.editor {
	align-self: stretch;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	padding: 0.5rem;
	overflow-y: auto;
}

.eraseSizeEditorHeaderRow {
	flex-shrink: 0;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 0.25rem;
}

.eraseSizeInput {
	border: 2px solid #CCC;
	border-radius: 4px;
	font-size: 1rem;
	width: 8ch;
}

.eraseSizeSlider {
	flex: 1;
	width: 3rem;
	min-height: 8rem;
	max-height: 20rem;
	display: flex;
	flex-direction: column;
}

.eraseSizeSlider > input {
	flex: 1;
	display: block;
	writing-mode: vertical-lr;
	transform: rotate(0.5turn);
}
</style>

<div class="controlGroup modeControlGroup">
	<div class=mainColumn>
		<div
			class={{button: true, modeButton: true, activeModeButton: !eraseWholeStroke}}
			role=button tabindex=0 title="Erase part of the stroke" aria-label="Erase part of the stroke"
			onclick={() => { eraseWholeStroke = false; }}
			onkeydown={event => {
				activateButtonFromKeyboard(event, () => { eraseWholeStroke = false; });
			}}
		><div>
			<IconEraserModePartial/>
		</div></div>
		<div
			class={{button: true, modeButton: true, activeModeButton: eraseWholeStroke}}
			role=button tabindex=0 title="Erase the whole stroke" aria-label="Erase the whole stroke"
			onclick={() => { eraseWholeStroke = true; }}
			onkeydown={event => {
				activateButtonFromKeyboard(event, () => { eraseWholeStroke = true; });
			}}
		><div>
			<IconEraserModeWhole/>
		</div></div>
	</div>
</div>
<div class=controlGroup>
	<div class=mainColumn>
		<div
			class="button toggleButton" role=button tabindex=0 aria-label="Expand/collapse erase size input"
			onclick={toggleEraseSizeInput}
			onkeydown={event => { activateButtonFromKeyboard(event, toggleEraseSizeInput); }}
		><div>
			{#if eraseSizeExpanded}
				<div class=collapseIcon><IconChevronLeftRounded/></div>
			{:else}
				<div class=eraseSizeDisplay>{eraseSize}</div>
			{/if}
		</div></div>
		<div class=separator></div>
		<div class=favorites>
			{#each favoriteEraseSizes as favoriteEraseSize}
				<div
					class="button favoriteEraseSize"
					role=button tabindex=0 aria-label={`Favorite erase size: ${favoriteEraseSize}`}
					onclick={() => { eraseSize = favoriteEraseSize; }}
					onkeydown={event => {
						activateButtonFromKeyboard(event, () => { eraseSize = favoriteEraseSize; });
					}}
				><div>
					<div class={{
						eraseSizeDisplay: true,
						activeFavoriteEraseSizeDisplay: favoriteEraseSize === eraseSize
					}}>{favoriteEraseSize}</div>
				</div></div>
			{/each}
		</div>
	</div>
	{#if eraseSizeExpanded}
		<div class=editor>
			<div class=eraseSizeEditorHeaderRow>
				<input
					type=number min=1 max=500 step=1
					bind:value={
						() => eraseSize.toString(),
						newValue => { eraseSize = Math.min(Math.max(newValue ?? eraseSize, 1), 500); }
					}
					class=eraseSizeInput
				>
				{#if currentEraseSizeIsFavorite}
					<div
						class="button favoriteButton activeFavoriteButton"
						role=button tabindex=0 aria-label="Remove erase size from favorites"
						onclick={removeEraseSizeFromFavorites}
						onkeydown={event => { activateButtonFromKeyboard(event, removeEraseSizeFromFavorites); }}
					><div>
						<IconStarRounded/>
					</div></div>
				{:else}
					<div
						class="button favoriteButton"
						role=button tabindex=0 aria-label="Add erase size to favorites"
						onclick={addEraseSizeToFavorites}
						onkeydown={event => { activateButtonFromKeyboard(event, addEraseSizeToFavorites); }}
					><div>
						<IconStarOutlineRounded/>
					</div></div>
				{/if}
			</div>
			<div class=eraseSizeSlider>
				<!--Slider orientation=vertical min={1} max={100} step={1} bind:value={eraseSize}/-->
				<input type=range min=1 max=100 step=1 bind:value={eraseSize}>
			</div>
		</div>
	{/if}
</div>