// src/lib/actions/tilt.js
export function tilt(node, options = {}) {
  let maxTilt = options.maxTilt ?? 12;
  let perspective = options.perspective ?? 800;
  let ease = options.ease ?? 0.1;

  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;
  let rafId;

  function onMouseMove(evt) {
    const rect = node.getBoundingClientRect();
    const x = evt.clientX;
    const y = evt.clientY;

    // Calculate position relative to element center
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalized position (-1 to 1)
    const offsetX = (x - centerX) / (rect.width / 2);
    const offsetY = (y - centerY) / (rect.height / 2);

    // Clamp to prevent extreme values at edges
    const clampedX = Math.max(-1, Math.min(1, offsetX));
    const clampedY = Math.max(-1, Math.min(1, offsetY));

    targetY = clampedX * maxTilt;
    targetX = -clampedY * maxTilt;
  }

  function onMouseLeave() {
    targetX = 0;
    targetY = 0;
  }

  function animate() {
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;

    node.style.transform = `perspective(${perspective}px) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
    rafId = requestAnimationFrame(animate);
  }

  // Initialize on mount
  node.style.transformStyle = 'preserve-3d';
  node.style.willChange = 'transform';

  window.addEventListener('mousemove', onMouseMove);
  node.addEventListener('mouseleave', onMouseLeave);

  animate();

  return {
    update(newOptions = {}) {
      maxTilt = newOptions.maxTilt ?? maxTilt;
      perspective = newOptions.perspective ?? perspective;
      ease = newOptions.ease ?? ease;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      node.removeEventListener('mouseleave', onMouseLeave);

      node.style.transform = '';
      node.style.transformStyle = '';
      node.style.willChange = '';
    }
  };
}