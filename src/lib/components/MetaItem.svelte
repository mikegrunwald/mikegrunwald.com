<script>
	let { label, value = null, values = [], fullWidth = false, awards = false, children } = $props();

	// Determine if we have multiple values
	const hasValues = values.length > 0;
	const hasSlot = children;
</script>

{#snippet metaValue(text)}
	<dd>
		<!-- The scramble rewrites textContent frame by frame, so assistive tech
		     would otherwise announce random glyphs. The hidden copy holds the
		     real, never-mutated string; the aria-hidden copy is the one that
		     animates. Same split the reference site (hubtown.co.in) uses. -->
		<span class="visually-hidden">{text}</span>
		<span class="scramble-target" aria-hidden="true">{text}</span>
	</dd>
{/snippet}

<div class="meta-item" class:full-width={fullWidth} class:awards>
	<dt class="h4">{label}</dt>
	{#if hasSlot}
		{@render children()}
	{:else if hasValues}
		{#each values as val}
			{@render metaValue(val)}
		{/each}
	{:else if value}
		{@render metaValue(value)}
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
		}

		&.awards {
			gap: var(--spacing-sm);
			margin-top: var(--spacing-xxs);
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

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	// Server-rendered with the real text already in it, so without this the
	// finished string sits on screen, readable, until its ScrollTrigger fires —
	// the scramble would then "resolve" text the viewer already read.
	// ScrambleEnterEffect reveals it at the exact moment the scramble begins.
	// Safe to hide: this span is aria-hidden, and .visually-hidden above holds
	// the same text for screen readers.
	.scramble-target {
		opacity: 0;
	}
</style>
