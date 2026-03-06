<script>
const {
	items,
	activeItem,
	onSelect,
	visible
} = $props();
</script>

<style>
.group {
	display: flex;
	flex-direction: row;
	border-radius: 8px;
	box-shadow: 0 0 8px rgb(0 0 0 / 50%);
	overflow: hidden;
}

.group > * {
	background-color: white;
	padding: 0.5em 1em;
	cursor: pointer;
}

.group > :not(:last-child) {
	border-right: 1px solid gray;
}

.group > :hover {
	background-color: #EEEEEE;
}

.activeControl {
	background-color: #4980FF;
	color: white;
}

.activeControl:hover {
	background-color: #6493FF;
}
</style>

<div class={"group"}>
	{#each items as item}
		<div class={{activeControl: item.key === activeItem}} onclick={() => { onSelect(item.key); }}>
			{item.text}
		</div>
	{/each}
</div>