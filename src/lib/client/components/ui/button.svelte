<script lang="ts">
	import { Button } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'black' | 'ghost' | 'danger';

	// Extend native button attributes, narrowing `type` to the 3 valid values.
	// Everything else (onclick, disabled, aria-*, form, name, …) comes from
	// HTMLButtonAttributes — no need to re-declare them.
	type Props = Omit<HTMLButtonAttributes, 'type'> & {
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		isActive?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		type = 'button', // safe default: never submits by accident
		variant = 'primary',
		isActive = false,
		class: className = '',
		children,
		...rest // forwards onclick, disabled, aria-*, ref, …
	}: Props = $props();
</script>

<Button.Root
	{type}
	class={[
		'cursor-pointer rounded-lg px-2 py-1.5 text-sm transition-colors',
		className,
		variant === 'primary' && 'primary_btn',
		variant === 'secondary' && 'secondary_btn',
		variant === 'black' && 'black_btn',
		variant === 'danger' && 'danger_btn',
		variant === 'ghost' && (isActive ? 'primary_btn' : 'ghost_btn')
	]
		.filter(Boolean)
		.join(' ')}
	data-variant={variant}
	data-active={isActive || undefined}
	{...rest}
>
	{@render children()}
</Button.Root>

<style>
	:global(.primary_btn) {
		background: linear-gradient(#2b7fff, #2b7fff);

		color: white;
		box-shadow:
			inset 0 1px 0 #ffffff56,
			inset 0 -2px 0 #0003,
			0 1px 2px #0006,
			0 8px 24px -6px #8ec5ff99;
	}
	:global(.primary_btn:hover) {
		background: linear-gradient(#50a1ff, #2b7fff);
	}
	:global(.primary_btn:active) {
		translate: 0 1px;
		box-shadow: inset 0 2px 4px #0004;
	}
	:global(.danger_btn) {
		background: linear-gradient(#ef4444, #ef4444);

		color: white;
		box-shadow:
			inset 0 1px 0 #ffffff56,
			inset 0 -2px 0 #0003,
			0 1px 2px #0006,
			0 8px 24px -6px #fca5a599;
	}
	:global(.danger_btn:hover) {
		background: linear-gradient(#f87171, #ef4444);
	}
	:global(.danger_btn:active) {
		translate: 0 1px;
		box-shadow: inset 0 2px 4px #0004;
	}
	:global(.black_btn) {
		background: linear-gradient(#18181b, #27272a);

		color: white;
		box-shadow:
			inset 0 1px 0 #ffffff56,
			inset 0 -2px 0 #0003,
			0 1px 2px #0006,
			0 8px 24px -6px #d4d4d899;
	}
	:global(.black_btn:active) {
		translate: 0 1px;
		box-shadow: inset 0 2px 4px #0004;
	}

	:global(.secondary_btn) {
		background: linear-gradient(#d1d5dc);
		color: #111828;
		box-shadow:
			inset 0 1px 0 #ffffff56,
			inset 0 -2px 0 #0003,
			0 1px 2px #0006,
			0 8px 24px -6px #d1d5dc99;
	}
	:global(.secondary_btn:hover) {
		background: linear-gradient(#e5e7eb, #d1d5dc);
	}
	:global(.secondary_btn:active) {
		translate: 0 1px;
		box-shadow: inset 0 2px 4px #0004;
	}
	:global(.ghost_btn) {
		background: transparent;

		color: #4a5565;
	}
	:global(.ghost_btn:hover) {
		background: #e5e7eb;

		color: #111828;
	}
	:global(.ghost_btn:active) {
		translate: 0 1px;
		box-shadow: inset 0 2px 4px #0004;
	}
</style>
