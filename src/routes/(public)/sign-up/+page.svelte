<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();

	import { passwordSchema, type PasswordRuleCode } from '$lib/validation-schemas/auth.js';
	import {
		Check,
		CircleCheck,
		Dot,
		Eye,
		EyeOff,
		Loader,
		LockKeyhole,
		LogIn,
		Mail,
		OctagonAlert,
		UserRound,
		X
	} from '@lucide/svelte';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	let name_value = $state('');
	let email_value = $state('');
	let password_value = $state('');

	let submitting = $state(false);
	let serverError = $derived(form?.message ?? '');

	let passwordError = $state({
		MIN_LENGTH: false,
		MISSING_NUMBER: false,
		MISSING_SPECIAL: false,
		WHITESPACE: false
	});
	function validateEmail() {
		serverError = '';
		// const input = event.target as HTMLInputElement;
		// let result = emailSchema.safeParse(input.value);
		// emailError = input.value && !result.success;
	}

	function validatePassword(event: Event) {
		serverError = '';
		const input = event.target as HTMLInputElement;
		const value = input.value;

		// Reset: false = rule passes
		passwordError.MIN_LENGTH = false;
		passwordError.MISSING_NUMBER = false;
		passwordError.MISSING_SPECIAL = false;
		passwordError.WHITESPACE = false;

		const result = passwordSchema.safeParse(value);
		if (result.success) return;

		for (const issue of result.error.issues) {
			// Narrow to the custom-issue branch — this is what makes `params` exist
			if (issue.code !== 'custom') continue;

			const code = (issue.params as { code?: PasswordRuleCode } | undefined)?.code;
			if (!code) continue;

			passwordError[code] = true; // now type-safe, no `in` check needed
		}
	}

	let viewPassword = $state(false);
</script>

<section
	class="scrollbar-custom relative flex h-full items-center justify-center overflow-auto rounded-sm p-5"
	in:fly={{ y: -10, duration: 130, easing: cubicOut }}
>
	<div class="grid aspect-square w-sm gap-5 rounded-lg bg-white p-5 text-sm">
		<section class="grid place-items-center">
			<div class="w-fit rounded-lg bg-gray-200 p-1.5">
				<LogIn class="text-gray-800" size="24" />
			</div>
		</section>
		<section class="grid place-items-center gap-1.5">
			<h2 class="text-2xl font-bold">Gettign started with email</h2>
			<p class="text-center">Make it possible for your community or people to reach out to you.</p>
		</section>
		{#if serverError.length > 0}
			<p
				class="relative flex items-center gap-1 rounded border py-2 pl-7 text-xs font-medium {!form?.success
					? 'border-red-300 bg-red-100 text-red-600'
					: ' border-green-300 bg-green-100 text-green-600 '}"
				in:fly={{ y: -10, duration: 130, easing: cubicIn }}
				out:fly={{ y: -10, duration: 130, easing: cubicOut }}
			>
				<span>
					{#if !form?.success}
						<OctagonAlert size={14} strokeWidth={2} />
					{:else}
						<CircleCheck size={14} strokeWidth={3} />
					{/if}
				</span>
				<span> {serverError}</span>
				<button
					type="button"
					class="absolute right-0 m-1 grid cursor-pointer place-items-center rounded-lg
					border border-transparent p-1 duration-75 ease-in

					{!form?.success
						? ' hover:border-red-300 hover:bg-red-200'
						: '  hover:border-green-300 hover:bg-green-200'}"
					onclick={() => (serverError = '')}
				>
					<X size={14} strokeWidth={3} />
				</button>
			</p>
		{/if}
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
			class="grid gap-2.5 text-base"
		>
			<div class="relative w-full">
				<UserRound size="14" class="absolute top-2.5 left-2 text-gray-800" strokeWidth="2" />
				<input
					name="name"
					type="text"
					class="w-full rounded-lg border-2 border-gray-600 py-1.5 pl-7
				{submitting ? 'opacity-70' : ''}
				text-sm transition-colors focus:border-blue-500 focus:outline-none"
					placeholder="Name"
					bind:value={name_value}
					minlength="3"
					disabled={submitting}
					required
				/>
			</div>
			<div class="relative w-full">
				<Mail size="14" class="absolute top-2.5 left-2 text-gray-800" strokeWidth="2" />
				<input
					name="email"
					type="email"
					class="w-full rounded-lg border-2 border-gray-600 py-1.5 pl-7
					{submitting ? 'opacity-70' : ''}
					text-sm transition-colors focus:border-blue-500 focus:outline-none"
					placeholder="Email"
					pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
					title="Please enter a valid email address"
					bind:value={email_value}
					oninput={validateEmail}
					disabled={submitting}
					required
				/>
			</div>
			<div class="relative w-full overflow-hidden rounded-lg">
				<LockKeyhole size="14" class="absolute top-2.5 left-2 text-gray-800" strokeWidth="2" />
				<input
					name="password"
					type={viewPassword ? 'text' : 'password'}
					class="w-full rounded-lg border-2 border-gray-600 px-7 py-1.5
					{submitting ? 'opacity-70' : ''}
					text-sm transition-colors focus:border-blue-500 focus:outline-none"
					placeholder="Password"
					bind:value={password_value}
					oninput={validatePassword}
					disabled={submitting}
					required
				/>
				<div class="absolute top-0 right-1.5 grid h-full place-items-center overflow-hidden">
					<button
						type="button"
						class=" cursor-pointer rounded-sm p-1.5 hover:bg-gray-200"
						onclick={() => (viewPassword = !viewPassword)}
					>
						{#if viewPassword}
							<Eye size="14" class=" text-gray-800" strokeWidth="2" />
						{:else}
							<EyeOff size="14" class=" text-gray-800" strokeWidth="2" />
						{/if}
					</button>
				</div>
			</div>

			{#if password_value.length > 0 && !submitting}
				<section class="  grid gap-0.5 text-xs">
					<p
						class="flex items-center gap-1 pl-7 font-medium {passwordError.MIN_LENGTH
							? ''
							: 'rounded bg-green-100 text-green-600'}"
					>
						<span>
							{#if passwordError.MIN_LENGTH}
								<Dot size={14} strokeWidth={3} />
							{:else}
								<Check size={14} strokeWidth={3} />
							{/if}
						</span>
						<span> 8 characters</span>
					</p>
					<p
						class="flex items-center gap-1 pl-7 font-medium {passwordError.MISSING_NUMBER
							? ''
							: 'rounded bg-green-100 text-green-600'}"
					>
						<span>
							{#if passwordError.MISSING_NUMBER}
								<Dot size={14} strokeWidth={3} />
							{:else}
								<Check size={14} strokeWidth={3} />
							{/if}
						</span>
						<span> 1 number </span>
					</p>
					<p
						class="flex items-center gap-1 pl-7 font-medium {passwordError.MISSING_SPECIAL
							? ''
							: 'rounded bg-green-100 text-green-600'}"
					>
						<span>
							{#if passwordError.MISSING_SPECIAL}
								<Dot size={14} strokeWidth={3} />
							{:else}
								<Check size={14} strokeWidth={3} />
							{/if}
						</span>
						<span> 1 special character e.g., $, !, @, %, & </span>
					</p>
					<p
						class="flex items-center gap-1 pl-7 font-medium {passwordError.WHITESPACE
							? ''
							: 'rounded bg-green-100 text-green-600'}"
					>
						<span>
							{#if passwordError.WHITESPACE}
								<Dot size={14} strokeWidth={3} />
							{:else}
								<Check size={14} strokeWidth={3} />
							{/if}
						</span>
						<span> No leading or trailing whitespace </span>
					</p>
				</section>
			{:else if !!submitting}
				<section
					class="flex items-center justify-center gap-0.5 text-xs font-semibold text-blue-500"
				>
					<h1>Verifying</h1>
					<Loader size="12" strokeWidth="3" class="animate-spin" />
				</section>
			{/if}

			<button
				type="submit"
				class="cursor-pointer rounded-lg bg-gray-900 py-1.5
				text-gray-50 transition-all duration-75 ease-in
			    hover:scale-[1.03] active:scale-[0.97]">Get Started</button
			>
			<!-- <div class=" my-2.5 w-full border-t border-dashed border-gray-400"></div>
			<button type="button" class="rounded-lg bg-blue-500 py-1.5 text-gray-50"
				>Login with Google</button
			> -->
		</form>
	</div>
</section>
