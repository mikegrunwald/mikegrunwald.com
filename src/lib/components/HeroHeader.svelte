<script>
</script>

<header class="hero">
  <h1 class="display">
    <span class="sr-only">Michael Grunwald</span>
    <!-- <span class="first-name">
      <span class="letter">M</span>
      <span class="letter">i</span>
      <span class="letter">c</span>
      <span class="letter">h</span>
      <span class="letter">a</span>
      <span class="letter">e</span>
      <span class="letter">l</span></span
    >
    <span class="letter">&nbsp;</span>
    <span class="letter">G</span>
    <span class="letter">r</span>
    <span class="letter">u</span>
    <span class="letter">n</span>
    <span class="letter">w</span>
    <span class="letter">a</span>
    <span class="letter">l</span>
    <span class="letter">d</span> -->
  </h1>
</header>

<style lang="scss">
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: right;
    flex: 1;
    min-height: 100dvh;
    width: 100%;
    overflow: hidden;
  }

  .display {
    color: var(--color-text-body);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-weight: 800;
    font-size: 27.4vw;
    letter-spacing: -0.026em;
    line-height: 1;
    margin: 0;
    width: 100%;
    filter: drop-shadow(0 0 0 rgba(var(--color-primary-rgb), 0.4));
    pointer-events: none;

    &:before {
      content: '';
      display: block;
      position: absolute;
      max-width: 90vw;
      height: 66vh;
      height: 66dvh;
      aspect-ratio: 1.153594844873037 / 1;
      background-image: url('/images/logo.svg');
      background-position: center;
      background-size: 90%;
      background-repeat: no-repeat;
      left: 50%;
      transform: translateX(-50%);

      mask-image: url('/images/smoke-texture-smooth.png');
      /* mask-size: contain; */
      mask-size: 131%;
      mask-position: bottom;
      /* mask-repeat: no-repeat; */

      filter: drop-shadow(0 0 1vh rgba(255, 255, 255, 0.33));
    }
  }

  .letter {
    text-shadow: -1.2vw 0 1vw rgba(0, 0, 0, 0.9);
    display: inline-block;
    transform: skew(-5deg);
    margin-top: 8.655vw;
  }

  .first-name {
    font-weight: 300;
    letter-spacing: -0.053em;
    filter: drop-shadow(0 0 0.2vw rgba(var(--color-primary-rgb), 1));

    .letter {
      text-shadow: none;
    }
  }
</style>
