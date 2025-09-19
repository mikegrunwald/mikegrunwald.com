<script>
  import { onMount } from 'svelte';
  import { blur, fade } from 'svelte/transition';
  import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

  let visible = $state(false);
  
  onMount(() => {
    setTimeout(() => {
      visible = true;
    }, 3000);

    const handleScroll = () => {
      if (window.scrollY > 50) {
        visible = false;
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

</script>

{#if visible}
<div transition:blur={{duration: 1000}} class="scroll-indicator">
  <div class="bar"></div>
  <small class="label" role="note">Scroll down</small>
</div>
{/if}


<style>
.scroll-indicator {
  position: absolute;
  bottom: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  /* opacity: 0; */

  --bar-height: 60px;
  --scrubber-height: 12px;

  @media (max-width: 768px) {
    bottom: 90px;
  }
}

.bar {
  background-color: rgba(255, 255, 255, 0.2);
  width: 1px;
  height: var(--bar-height);
  position: relative;
  overflow: hidden;

  &:after {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: var(--scrubber-height);
    background-color: white;
    animation: scroll 1.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both infinite;
  }
}

.label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  animation: blink 4.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) 4.5s both infinite;
}

@keyframes scroll {
  0% {
    transform: translateY(calc(var(--scrubber-height) * -1));
  }

  100% {
    transform: translateY(calc(var(--bar-height) + var(--scrubber-height)));
  }
}

@keyframes blink {
  0%,
  85%,
  95% {
    opacity: 0;
  }
  90%,
  100% {
    opacity: 1;
  }
}
</style>



