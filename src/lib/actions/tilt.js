// src/lib/actions/tilt.js
export function tilt(node, options = {}) {
  let maxTilt = options.maxTilt ?? 12;
  let perspective = options.perspective ?? 800;
  let ease = options.ease ?? 0.1;

  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;
  let rafId;

  function updateBounds() {
    const rect = node.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    left = rect.left;
    top = rect.top;
  }

  function onMouseMove(evt) {
    const rect = node.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    const offsetX = (x - halfW) / halfW;
    const offsetY = (y - halfH) / halfH;

    targetY = offsetX * maxTilt;
    targetX = -offsetY * maxTilt;
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
  updateBounds();
  node.style.transformStyle = 'preserve-3d';
  node.style.willChange = 'transform';

  node.addEventListener('mousemove', onMouseMove);
  node.addEventListener('mouseleave', onMouseLeave);
  window.addEventListener('resize', updateBounds);

  animate();

  return {
    update(newOptions = {}) {
      maxTilt = newOptions.maxTilt ?? maxTilt;
      perspective = newOptions.perspective ?? perspective;
      ease = newOptions.ease ?? ease;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      node.removeEventListener('mousemove', onMouseMove);
      node.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', updateBounds);

      node.style.transform = '';
      node.style.transformStyle = '';
      node.style.willChange = '';
    }
  };
}