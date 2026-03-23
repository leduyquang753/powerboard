<script>
import {activateButtonFromKeyboard} from "$lib/utils/ButtonActivation.js";

import IconReset from "~icons/powerboard-icons/reset";

let {onResetPan} = $props();
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
	font-size: 1.5rem;
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
</style>

<div class=controlGroup>
	<div class=mainColumn>
		<div
			class=button role=button tabindex=0 title="Reset pan" aria-label="Reset pan"
			onclick={() => { onResetPan(); }} onkeydown={event => { activateButtonFromKeyboard(event, onResetPan); }}
		><div>
			<IconReset/>
		</div></div>
	</div>
</div>