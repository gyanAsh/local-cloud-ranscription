<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<main class="grid h-dvh w-dvw place-items-center">
	{@render children()}
</main>
