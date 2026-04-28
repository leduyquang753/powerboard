<script>
import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

import IconRedoRounded from "~icons/material-symbols/redo-rounded";
import IconUndoRounded from "~icons/material-symbols/undo-rounded";

let {canUndo, canRedo, onUndo, onRedo} = $props();

function handleUndo() {
	if (canUndo) onUndo();
}

function handleRedo() {
	if (canRedo) onRedo();
}
</script>

<style>
.controlGroup {
	position: relative;
	min-height: 0;
	width: fit-content;
	display: flex;
	flex-direction: column;
	align-items: start;
	gap: 0.25rem;
	border-radius: 1.5rem;
	background: var(--controlBackground);
	box-shadow: 0 0 4px rgb(0 0 0 / 50%);
}

.mainRow {
	display: flex;
	flex-direction: row;
	align-items: start;
	height: 100%;
}

.button.enabled {
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
	font-size: 1.5rem;
}

.button:not(.enabled) > div {
	color: gray;
}

.button:focus-visible {
	outline: none
}

.button.enabled:hover > div {
	background: rgba(0 0 0 / 10%);
}

.button:focus-visible > div {
	outline: 1px solid black;
}
</style>

<div class=controlGroup>
	<div class=mainRow>
		<div
			class={{button: true, enabled: canUndo}}
			role=button tabindex=0 title="Undo" aria-label="Undo"
			onclick={() => { handleUndo(); }} onkeydown={event => { activateButtonFromKeyboard(event, handleUndo); }}
		><div>
			<IconUndoRounded/>
		</div></div>
		<div
			class={{button: true, enabled: canRedo}}
			role=button tabindex=0 title="Redo" aria-label="Redo"
			onclick={() => { handleRedo(); }} onkeydown={event => { activateButtonFromKeyboard(event, handleRedo); }}
		><div>
			<IconRedoRounded/>
		</div></div>
	</div>
</div>