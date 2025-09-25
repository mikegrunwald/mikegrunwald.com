<script>
  import { onMount, onDestroy } from "svelte";

  let dot;
  let mouseX = 0;
  let mouseY = 0;
  let dotX = 0;
  let dotY = 0;
  let lastX = 0;
  let lastY = 0;
  const ease = 0.18;
  let animationFrame;

  function animate() {
    // Lerp position
    dotX += (mouseX - dotX) * ease;
    dotY += (mouseY - dotY) * ease;

    // Velocity for squash/stretch
    const vx = dotX - lastX;
    const vy = dotY - lastY;
    lastX = dotX;
    lastY = dotY;

    const speed = Math.sqrt(vx * vx + vy * vy);

    // Normalize direction
    const angle = Math.atan2(vy, vx);
    const stretch = Math.min(speed * 0.05, 0.35); // max squash amount

    // Build transform
    const isBig = dot.classList.contains("cursor-dot--big");
    const scale = isBig ? 2.6 : 1;
    const sx = 1 + stretch;
    const sy = 1 - stretch;

    if (dot) {
      dot.style.transform = `
        translate(${dotX}px, ${dotY}px)
        translate(-50%, -50%)
        rotate(${angle}rad)
        scale(${sx * scale}, ${sy * scale})
      `;
    }

    animationFrame = requestAnimationFrame(animate);
  }

  function bindHoverState() {
    const interactiveSelector =
      "a, button, input, textarea, select, [role='button'], [data-cursor='hover']";
    const els = document.querySelectorAll(interactiveSelector);
    els.forEach((el) => {
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = "1";
      el.addEventListener("mouseenter", () => dot.classList.add("cursor-dot--big"));
      el.addEventListener("mouseleave", () => dot.classList.remove("cursor-dot--big"));
      el.addEventListener("focus", () => dot.classList.add("cursor-dot--big"));
      el.addEventListener("blur", () => dot.classList.remove("cursor-dot--big"));
    });
  }

  onMount(() => {
    const moveHandler = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dot) dot.style.opacity = "0.95";
    };
    const leaveHandler = () => {
      if (dot) dot.style.opacity = "0";
    };
    const touchHandler = () => {
      if (dot) dot.style.opacity = "0";
    };

    window.addEventListener("mousemove", moveHandler, { passive: true });
    window.addEventListener("mouseleave", leaveHandler);
    window.addEventListener("touchstart", touchHandler, { passive: true });

    const mo = new MutationObserver(() => bindHoverState());
    mo.observe(document.body, { childList: true, subtree: true });
    bindHoverState();

    animationFrame = requestAnimationFrame(animate);

    onDestroy(() => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseleave", leaveHandler);
      window.removeEventListener("touchstart", touchHandler);
      mo.disconnect();
      cancelAnimationFrame(animationFrame);
    });
  });
</script>

<style>
  .cursor-dot {
    --dot-size: 12px;

    position: fixed;
    left: 0;
    top: 0;
    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;
    background: var(--color-action);
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.08);
    transform: translate(-50%, -50%) scale(1);
    pointer-events: none;
    z-index: 9999;
    transition: opacity 200ms;
    will-change: transform, opacity;
    opacity: 0.95;
  }

  .cursor-dot--big {
    /* scaling now handled in JS */
  }

  @media (pointer: coarse) {
    .cursor-dot {
      display: none;
    }
  }
</style>

<div class="cursor-dot" bind:this={dot} aria-hidden="true"></div>