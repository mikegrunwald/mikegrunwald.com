<script>
  // your script goes here
</script>

<section class="user-actions">
  <nav>
    <ul class="nav-list">
      <li class="nav-item">
        <a class="button outline" href="/documents/Michael-Grunwald-Resume-2025.pdf" target="_blank"
          >Resume</a
        >
      </li>
      <li class="nav-item">
        <a
          class="button outline"
          href="https://www.figma.com/deck/fijb1PSnc74AcqqcZrWqwM/grunwald-work-samples-2024?node-id=1-538&t=eBwKyVrmTTjryIgI-1"
          target="_blank">Work Samples</a
        >
      </li>
      <li class="nav-item">
        <a class="button outline" href="https://www.linkedin.com/in/mikegrunwald/" target="_blank"
          >LinkedIn</a
        >
      </li>
    </ul>
  </nav>
</section>

<style lang="scss">
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
  }

  .button {
    position: relative;
    z-index: 10;
  }
</style>
