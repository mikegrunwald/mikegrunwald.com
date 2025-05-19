<script>
  import '../../app.scss';
  // import PageHeader from '../lib/components/PageHeader.svelte';
  import { onMount } from 'svelte';
  export const prerender = true;
</script>

<div class="app" id="app">
  <main>
    <slot></slot>
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    position: relative;
    z-index: 1;
    overflow: scroll;
    padding: var(--spacing-base);

    @media (max-width: 960px) {
      padding: var(--spacing-sm) var(--spacing-xs);
    }
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
    box-sizing: border-box;
    max-width: 1280px;
  }
</style>
