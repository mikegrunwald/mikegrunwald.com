<script>
	import { trackLink } from '$lib/track';
	import { tilt } from '$lib/actions/tilt';

	const listTiltOptions = { maxTilt: 4.1, perspective: 1340, ease: 0.067 };
	const itemTiltOptions = { maxTilt: 8.2, perspective: 670, ease: 0.067 };
</script>

<section class="user-actions">
	<nav>
		<ul class="nav-list" use:tilt={listTiltOptions}>
			<li class="nav-item">
				<a
					use:tilt={itemTiltOptions}
					data-cursor="magnetic"
					class="button outline"
					href="/documents/Michael-Grunwald-Resume-2025.pdf"
					target="_blank"
					rel="noopener noreferrer"
					on:click={() => trackLink('Resume')}>Resume</a
				>
			</li>
			<li class="nav-item">
				<a
					data-cursor="magnetic"
					class="button outline"
					href="https://www.figma.com/deck/fijb1PSnc74AcqqcZrWqwM/grunwald-work-samples-2024?node-id=1-538&t=eBwKyVrmTTjryIgI-1"
					target="_blank"
					rel="noopener noreferrer"
					on:click={() => trackLink('Work Samples')}>Work Samples</a
				>
			</li>
			<li class="nav-item">
				<a
					use:tilt={itemTiltOptions}
					data-cursor="magnetic"
					class="button outline"
					href="https://www.linkedin.com/in/mikegrunwald/"
					target="_blank"
					rel="noopener noreferrer"
					on:click={() => trackLink('Linkedin')}>LinkedIn</a
				>
			</li>
		</ul>
	</nav>
</section>

<style lang="scss">
	.user-actions {
		overflow: hidden;
	}
	.nav-list {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-xs);
		padding: 0 var(--spacing-base) var(--spacing-xl);
		min-height: 50vh;
		min-height: 50dvh;

		@media (max-width: 1280px) {
			flex-direction: column;
			min-height: auto;
			gap: var(--spacing-sm);
			padding-top: var(--spacing-sm);
		}

		@media (max-width: 768px) {
			min-height: 100vh;
			min-height: 100dvh;
			justify-content: center;
			padding: var(--spacing-sm);
		}
	}

	.button {
		display: block;
		position: relative;
		pointer-events: auto;
		// z-index: 10;
	}
</style>
