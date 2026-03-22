<script>
import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

//import Slider from "$controls/Slider.svelte";

import IconChevronLeftRounded from "~icons/material-symbols/chevron-left-rounded";
import IconStarOutlineRounded from "~icons/material-symbols/star-outline-rounded";
import IconStarRounded from "~icons/material-symbols/star-rounded";

let {
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

.collapseIcon, .favoriteButton {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	font-size: 1.5rem;
}

.activeFavoriteButton {
	color: #0078D4;
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

.editor {
	align-self: stretch;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	padding: 0.5rem;
	overflow-y: auto;
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
					<div class=eraseSizeDisplay>{favoriteEraseSize}</div>
				</div></div>
			{/each}
		</div>
	</div>
	{#if eraseSizeExpanded}
		<div class=editor>
			<input
				type=number min=1 max=500 step=1
				bind:value={
					() => eraseSize.toString(),
					newValue => { eraseSize = Math.min(Math.max(newValue ?? eraseSize, 1), 500); }
				}
				class=eraseSizeInput
			>
			<div class=eraseSizeSlider>
				<!--Slider orientation=vertical min={1} max={100} step={1} bind:value={eraseSize}/-->
				<input type=range min=1 max=100 step=1 bind:value={eraseSize}>
			</div>
		</div>
	{/if}
</div>