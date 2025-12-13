<script>
	import { getAssetUrl } from '$lib/config.js';
	import 'video.js/dist/video-js.css';
</script>

<svelte:head>
	<title>Michael Grunwald | Operation Tripod</title>
</svelte:head>

<article class="content">
	<div class="project">
		<header class="project-header">
			<h3 class="h2">Operation Tripod</h3>
		</header>
		<video
			class="video-js"
			controls
			preload="auto"
			poster={getAssetUrl('/images/projects/tripod-poster.png')}
			src={getAssetUrl('/video/operation-tripod.mp4')}
		/>
		<p>
			At Active Theory, I created the frontend interface for an internal ChatGPT tool, working
			closely with a backend developer who handled the model integrations. I led the design and
			motion work, shaping the entire user experience from layout to micro-interactions to feel
			intuitive and polished.
		</p>
		<p>
			The tool features three custom-trained models, each tailored for specific internal tasks,
			which users can easily switch between depending on their needs.
		</p>
		<p>
			It was a rewarding project that combined thoughtful design with powerful functionality and
			played a key role in streamlining how our team accessed and leveraged AI internally.
		</p>
	</div>
</article>

<style>
	.content {
		pointer-events: auto;
	}

	hr {
		margin: 0 0 var(--spacing-sm);
	}

	h1 {
		text-align: center;
		margin-bottom: var(--spacing-base);
	}

	.h2 {
		letter-spacing: 0.03em;
		color: var(--color-primary);
	}

	.h3 {
		letter-spacing: 0.06em;
		margin-bottom: 0;
	}

	.project {
		margin-bottom: var(--spacing-base);
	}

	video {
		width: 100%;
		height: auto;
		margin: 0 auto var(--spacing-sm);
		display: block;
		cursor: pointer;
	}

	p {
		line-height: 1.4;
	}

	img {
		width: 100%;
		height: auto;
		max-width: 1280px;
		margin: 0 auto;
		display: block;
	}

	.gallery {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-xs);
	}

	.project-image {
		margin-bottom: var(--spacing-sm);
	}
</style>
