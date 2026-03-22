<script>
import ColorPicker from "svelte-awesome-color-picker";

import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

//import Slider from "$controls/Slider.svelte";

import IconChevronLeftRounded from "~icons/material-symbols/chevron-left-rounded";
import IconStarOutlineRounded from "~icons/material-symbols/star-outline-rounded";
import IconStarRounded from "~icons/material-symbols/star-rounded";

let {
	drawSize = $bindable(),
	favoriteDrawSizes = $bindable(),
	drawColor = $bindable(),
	favoriteDrawColors = $bindable()
} = $props();

const currentDrawSizeIsFavorite = $derived(favoriteDrawSizes.includes(drawSize));
const currentDrawColorIsFavorite = $derived(favoriteDrawColors.includes(drawColor));
let drawSizeExpanded = $state(false);
let drawColorExpanded = $state(false);

function toggleDrawSizeInput() {
	drawSizeExpanded = !drawSizeExpanded;
}

function toggleDrawColorInput() {
	drawColorExpanded = !drawColorExpanded;
}

function addDrawSizeToFavorites() {
	let insertIndex = favoriteDrawSizes.length;
	for (let i = 0; i < favoriteDrawSizes.length; ++i) {
		if (favoriteDrawSizes[i] > drawSize) {
			insertIndex = i;
			break;
		}
	}
	favoriteDrawSizes.splice(insertIndex, 0, drawSize);
}

function removeDrawSizeFromFavorites() {
	favoriteDrawSizes.splice(favoriteDrawSizes.indexOf(drawSize), 1);
}

function addDrawColorToFavorites() {
	favoriteDrawColors.push(drawColor);
}

function removeDrawColorFromFavorites() {
	favoriteDrawColors.splice(favoriteDrawColors.indexOf(drawColor), 1);
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

@container sideControls (height >= 31rem) {
	.controlGroup {
		max-height: max(15rem, (100% - 1rem) / 2);
	}
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

.drawSizeInput {
	border: 2px solid #CCC;
	border-radius: 4px;
	font-size: 1rem;
	width: 8ch;
}

.drawSizeSlider {
	flex: 1;
	width: 3rem;
	min-height: 8rem;
	max-height: 20rem;
	display: flex;
	flex-direction: column;
}

.drawSizeSlider > input {
	flex: 1;
	display: block;
	writing-mode: vertical-lr;
	transform: rotate(0.5turn);
}

.drawColorDisplay {
	width: 2rem;
	height: 2rem;
	border-radius: 1rem;
	background: var(--displayed-color);
	border: 1px solid black;
}

.drawColorPreview {
	flex-shrink: 0;
	align-self: stretch;
	margin: 0 1rem;
	height: 2rem;
	border-radius: 0.5rem;
	background: var(--displayed-color);
}
</style>

<div class=controlGroup>
	<div class=mainColumn>
		<div
			class="button toggleButton" role=button tabindex=0 aria-label="Expand/collapse draw size input"
			onclick={toggleDrawSizeInput}
			onkeydown={event => { activateButtonFromKeyboard(event, toggleDrawSizeInput); }}
		><div>
			{#if drawSizeExpanded}
				<div class=collapseIcon><IconChevronLeftRounded/></div>
			{:else}
				<div class=drawSizeDisplay>{drawSize}</div>
			{/if}
		</div></div>
		{#if currentDrawSizeIsFavorite}
			<div
				class="button favoriteButton activeFavoriteButton"
				role=button tabindex=0 aria-label="Remove draw size from favorites"
				onclick={removeDrawSizeFromFavorites}
				onkeydown={event => { activateButtonFromKeyboard(event, removeDrawSizeFromFavorites); }}
			><div>
				<IconStarRounded/>
			</div></div>
		{:else}
			<div
				class="button favoriteButton"
				role=button tabindex=0 aria-label="Add draw size to favorites"
				onclick={addDrawSizeToFavorites}
				onkeydown={event => { activateButtonFromKeyboard(event, addDrawSizeToFavorites); }}
			><div>
				<IconStarOutlineRounded/>
			</div></div>
		{/if}
		<div class=favorites>
			{#each favoriteDrawSizes as favoriteDrawSize}
				<div
					class="button favoriteDrawSize"
					role=button tabindex=0 aria-label={`Favorite draw size: ${favoriteDrawSize}`}
					onclick={() => { drawSize = favoriteDrawSize; }}
					onkeydown={event => { activateButtonFromKeyboard(event, () => { drawSize = favoriteDrawSize; }); }}
				><div>
					<div class=drawSizeDisplay>{favoriteDrawSize}</div>
				</div></div>
			{/each}
		</div>
	</div>
	{#if drawSizeExpanded}
		<div class=editor>
			<input
				type=number min=1 max=100 step=1
				bind:value={
					() => drawSize.toString(),
					newValue => { drawSize = Math.min(Math.max(newValue ?? drawSize, 1), 100); }
				}
				class=drawSizeInput
			>
			<div class=drawSizeSlider>
				<!--Slider orientation=vertical min={1} max={100} step={1} bind:value={drawSize}/-->
				<input type=range min=1 max=100 step=1 bind:value={drawSize}>
			</div>
		</div>
	{/if}
</div>
<div class=controlGroup>
	<div class=mainColumn>
		<div
			class="button toggleButton" role=button tabindex=0 aria-label="Expand/collapse draw color input"
			onclick={toggleDrawColorInput}
			onkeydown={event => { activateButtonFromKeyboard(event, toggleDrawColorInput); }}
		><div>
			{#if drawColorExpanded}
				<div class=collapseIcon><IconChevronLeftRounded/></div>
			{:else}
				<div class=drawColorDisplay style:--displayed-color={drawColor}></div>
			{/if}
		</div></div>
		{#if currentDrawColorIsFavorite}
			<div
				class="button favoriteButton activeFavoriteButton"
				role=button tabindex=0 aria-label="Remove draw color from favorites"
				onclick={removeDrawColorFromFavorites}
				onkeydown={event => { activateButtonFromKeyboard(event, removeDrawColorFromFavorites); }}
			><div>
				<IconStarRounded/>
			</div></div>
		{:else}
			<div
				class="button favoriteButton"
				role=button tabindex=0 aria-label="Add draw color to favorites"
				onclick={addDrawColorToFavorites}
				onkeydown={event => { activateButtonFromKeyboard(event, addDrawColorToFavorites); }}
			><div>
				<IconStarOutlineRounded/>
			</div></div>
		{/if}
		<div class=favorites>
			{#each favoriteDrawColors as favoriteDrawColor}
				<div
					class="button favoriteDrawColor"
					role=button tabindex=0 aria-label={`Favorite draw color: ${favoriteDrawColor}`}
					onclick={() => { drawColor = favoriteDrawColor; }}
					onkeydown={event => {
						activateButtonFromKeyboard(event, () => { drawColor = favoriteDrawColor; });
					}}
				><div>
					<div class=drawColorDisplay style:--displayed-color={favoriteDrawColor}></div>
				</div></div>
			{/each}
		</div>
	</div>
	{#if drawColorExpanded}
		<div class=editor>
			<div class=drawColorPreview style:--displayed-color={drawColor}></div>
			<ColorPicker
				bind:hex={
					() => drawColor,
					newColor => { drawColor = newColor.toUpperCase(); }
				}
				isAlpha={false} isDialog={false} --cp-border-color=transparent --cp-text-color=black
			/>
		</div>
	{/if}
</div>