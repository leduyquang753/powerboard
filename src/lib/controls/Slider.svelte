<script>
import {Slider} from "bits-ui";

let {value = $bindable(), ...props} = $props();
</script>

<Slider.Root type=single bind:value {...props}>
	<div><Slider.Range/></div>
	<Slider.Thumb index={0}/>
</Slider.Root>