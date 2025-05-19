<script>
</script>

<header class="page-header">
  <nav class="page-nav">
    <ul class="nav-list">
      <li class="nav-item"><a class="nav-link" href="#about">About</a></li>
      <li class="nav-item"><a class="nav-link" href="/">Work</a></li>
      <li class="nav-item"><a class="nav-link" href="/">Contact</a></li>
    </ul>
  </nav>
</header>

<style>
  .page-header {
    padding: var(--spacing-xs) 0;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .nav-list {
    display: flex;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-xs);
  }

  .nav-link {
    display: block;
    font-family: var(--font-family-heading);
    font-size: 1rem;
    font-weight: 300;
    letter-spacing: 0.03em;
    line-height: 1;
    text-transform: uppercase;
    text-decoration: none;
  }
</style>
