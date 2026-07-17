// Single owner of pointer state for all GPU scenes.
// Pointer object shape intentionally mirrors WebGLFluid.js PointerPrototype.

export function correctDeltaX(delta, aspect) {
	return aspect < 1 ? delta * aspect : delta;
}

export function correctDeltaY(delta, aspect) {
	return aspect > 1 ? delta / aspect : delta;
}

function makePointer() {
	return {
		id: -1,
		texcoordX: 0,
		texcoordY: 0,
		prevTexcoordX: 0,
		prevTexcoordY: 0,
		deltaX: 0,
		deltaY: 0,
		down: false,
		moved: false,
		color: { r: 0, g: 0, b: 0 }
	};
}

// Invariant: texcoord must equal clientX/cssWidth (CSS pixels on both sides),
// regardless of devicePixelRatio. `getSize` passed in below must therefore
// return CSS pixel dimensions (canvas.clientWidth/clientHeight), NOT the
// device-pixel backing-store size — that size is capped (Math.min(dpr, 2) in
// engine.js pickQuality) and would desync from the raw devicePixelRatio on
// dpr>2 devices if we scaled clientX/Y here. Do not reintroduce a DPR
// multiply on clientX/clientY in this file.
export function texcoordFromClient(client, cssSize) {
	return client / cssSize;
}

export function createPointerInput({ getSize }) {
	const pointers = [makePointer()];
	const listeners = [];
	let mousemoveTimer = null;

	function updateDown(pointer, id, posX, posY) {
		const { width, height } = getSize();
		pointer.id = id;
		pointer.down = true;
		pointer.moved = false;
		pointer.texcoordX = texcoordFromClient(posX, width);
		pointer.texcoordY = texcoordFromClient(posY, height); // top-left uv convention (no flip)
		pointer.prevTexcoordX = pointer.texcoordX;
		pointer.prevTexcoordY = pointer.texcoordY;
		pointer.deltaX = 0;
		pointer.deltaY = 0;
	}

	function updateMove(pointer, posX, posY) {
		const { width, height } = getSize();
		const aspect = width / height;
		pointer.prevTexcoordX = pointer.texcoordX;
		pointer.prevTexcoordY = pointer.texcoordY;
		pointer.texcoordX = texcoordFromClient(posX, width);
		pointer.texcoordY = texcoordFromClient(posY, height);
		pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX, aspect);
		pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY, aspect);
		// TRIGGER === 'hover' semantics (the only trigger used in production)
		pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
	}

	function on(target, type, fn, opts) {
		target.addEventListener(type, fn, opts);
		listeners.push([target, type, fn]);
	}

	function start() {
		on(document, 'mousedown', (e) => {
			let pointer = pointers.find((p) => p.id === -1) ?? makePointer();
			updateDown(pointer, -1, e.clientX, e.clientY);
		});

		// Original delays mousemove attachment 500ms (WebGLFluid.js:1472-1478)
		mousemoveTimer = setTimeout(() => {
			on(document, 'mousemove', (e) => {
				updateMove(pointers[0], e.clientX, e.clientY);
			});
		}, 500);

		on(document, 'mouseup', () => {
			pointers[0].down = false;
		});

		on(document, 'touchstart', (e) => {
			const touches = e.targetTouches;
			while (touches.length >= pointers.length) pointers.push(makePointer());
			for (let i = 0; i < touches.length; i++) {
				updateDown(pointers[i + 1], touches[i].identifier, touches[i].clientX, touches[i].clientY);
			}
		});

		on(document, 'touchmove', (e) => {
			const touches = e.targetTouches;
			for (let i = 0; i < touches.length; i++) {
				updateMove(pointers[i + 1], touches[i].clientX, touches[i].clientY);
			}
		});

		on(document, 'touchend', (e) => {
			const touches = e.changedTouches;
			for (let i = 0; i < touches.length; i++) {
				const pointer = pointers.find((p) => p.id === touches[i].identifier);
				if (pointer) pointer.down = false;
			}
		});
	}

	function stop() {
		clearTimeout(mousemoveTimer);
		mousemoveTimer = null;
		for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
		listeners.length = 0;
	}

	// Re-export the CSS-px `getSize` closure passed in (engine.js's canvas
	// clientWidth/clientHeight-with-fallback measurement) so other scenes
	// (Task 6's LogoParticlesScene pointer-to-plane-local transform) can reuse
	// the exact same measurement instead of duplicating the fallback logic.
	return { pointers, start, stop, getSize };
}
