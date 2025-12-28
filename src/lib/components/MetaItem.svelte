<script>
	let { label, value = null, values = [], fullWidth = false, awards = false, children } = $props();

	// Determine if we have multiple values
	const hasValues = values.length > 0;
	const hasSlot = children;
</script>

<div class="meta-item" class:full-width={fullWidth} class:awards>
	<dt class="h4">{label}</dt>
	{#if hasSlot}
		{@render children()}
	{:else if hasValues}
		{#each values as val}
			<dd>{val}</dd>
		{/each}
	{:else if value}
		<dd>{value}</dd>
	{/if}
</div>

<style lang="scss">
	.meta-item {
		&.full-width {
			width: 100%;
			display: flex;
			align-items: end;
			flex-wrap: wrap;
			gap: 2px 4px;

			dt {
				margin-bottom: 0;
				margin-right: 0.5em;
			}

			dd {
				// display: inline-block;
			}
		}

		&.awards {
			gap: var(--spacing-xs);
		}
	}

	dt {
		margin-bottom: var(--spacing-xxs);
		color: var(--color-primary);
	}

	dd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-body-xxs);
		letter-spacing: 0.01em;
		line-height: var(--line-height-text);
		margin-left: 0.75em;
		display: block;
	}
</style>
