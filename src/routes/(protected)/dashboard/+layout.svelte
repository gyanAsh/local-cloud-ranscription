<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import House from '@lucide/svelte/icons/house';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import User from '@lucide/svelte/icons/user';
	import Calendar from '@lucide/svelte/icons/calendar';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import type { Pathname } from '$app/types';
	import { fly } from 'svelte/transition';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import Button from '$lib/client/components/ui/button.svelte';
	import { goto } from '$app/navigation';

	const { children } = $props();

	const links = [
		{ path: '/', title: 'Home', icon: House },
		{ path: '/dashboard', title: 'Dashboard', icon: LayoutDashboard, active_on: ['random'] },
		{ path: '/dashboard/my-page', title: 'My Page', icon: User, active_on: ['[slug]'] },
		{ path: '/dashboard/appointments', title: 'Appointments', icon: Calendar },
		{ path: '/dashboard/courses', title: 'Courses', icon: GraduationCap },
		{ path: '/dashboard/products', title: 'Products', icon: ShoppingBag }
	];
</script>

<section class="flex h-dvh w-dvw bg-[#F5F5F5]">
	<nav
		class="m-2 hidden w-50 flex-col gap-1 p-2 md:flex"
		in:fly={{ x: -10, duration: 130, easing: cubicOut }}
		out:fly={{ x: -10, duration: 130, easing: cubicIn }}
	>
		{#each links as { path, icon: Icon, title, active_on } (path)}
			{@const isActive =
				page.url.pathname === path ||
				active_on?.some((e) => {
					if (e === '[slug]') return page.url.pathname.startsWith(path);
					else return page.url.pathname === path + `/${e}`;
				})}
			<Button {isActive} variant="ghost" onclick={() => goto(resolve(path as Pathname))}>
				<div class="flex items-center gap-2">
					<Icon size={18} strokeWidth={2} />
					<span>{title}</span>
				</div>
			</Button>
		{/each}
	</nav>

	<div class="scrollbar-custom m-2 grow overflow-auto rounded-lg border bg-[#FDFDFD] p-2">
		{@render children()}
	</div>
</section>
