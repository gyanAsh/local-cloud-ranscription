<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const logout_users = async () => {
		const res = await fetch('/api/auth/logout', {
			method: 'POST'
		});
		const resdata = await res.json();
		if (resdata.success) return goto(resolve('/sign-in'));
	};
</script>

<section class="grid place-items-center gap-1">
	<h1>Logout</h1>

	<button onclick={logout_users} class="bg-blue-500 px-2 py-1 text-sm">Logout</button>
</section>
